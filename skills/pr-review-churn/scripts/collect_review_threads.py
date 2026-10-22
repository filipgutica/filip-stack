#!/usr/bin/env python3
"""Collect authored GitHub PR review threads for recurring review-churn analysis."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
from typing import Any


QUERY = """
query($searchQuery: String!, $after: String) {
  search(type: ISSUE, query: $searchQuery, first: 25, after: $after) {
    issueCount
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      ... on PullRequest {
        number
        title
        url
        state
        createdAt
        updatedAt
        closedAt
        mergedAt
        baseRefName
        headRefName
        author {
          login
        }
        reviewDecision
        reviews(first: 25) {
          nodes {
            author {
              login
            }
            state
            submittedAt
            url
          }
        }
        reviewThreads(first: 50) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            isResolved
            isOutdated
            path
            line
            startLine
            comments(first: 50) {
              totalCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                url
                body
                createdAt
                updatedAt
                diffHunk
                author {
                  login
                }
              }
            }
          }
        }
      }
    }
  }
}
"""


def run_gh(args: list[str]) -> Any:
    result = subprocess.run(
        ["gh", *args],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return json.loads(result.stdout)


def infer_author() -> str:
    result = subprocess.run(
        ["gh", "api", "user", "--jq", ".login"],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Unable to infer GitHub login")
    login = result.stdout.strip()
    if not login:
        raise RuntimeError("Unable to infer GitHub login")
    return login


def since_date(days: int, now: dt.datetime) -> str:
    return (now - dt.timedelta(days=days)).date().isoformat()


def collect_repo(repo: str, author: str, since: str, max_pages: int) -> dict[str, Any]:
    search_query = f"repo:{repo} is:pr author:{author} created:>={since}"
    prs: list[dict[str, Any]] = []
    after = None
    issue_count = None
    page = 0
    limitations: list[str] = []

    while True:
        page += 1
        gh_args = [
            "api",
            "graphql",
            "-f",
            f"query={QUERY}",
            "-F",
            f"searchQuery={search_query}",
        ]
        if after:
            gh_args.extend(["-F", f"after={after}"])

        data = run_gh(gh_args)
        search = data["data"]["search"]
        issue_count = search["issueCount"]
        page_prs = [node for node in search["nodes"] if node]
        prs.extend(page_prs)

        for pr in page_prs:
            threads = pr.get("reviewThreads") or {}
            if (threads.get("pageInfo") or {}).get("hasNextPage"):
                limitations.append(
                    f"PR #{pr.get('number')} has more than 50 review threads; nested thread pagination was truncated."
                )
            for thread in threads.get("nodes") or []:
                comments = thread.get("comments") or {}
                if (comments.get("pageInfo") or {}).get("hasNextPage"):
                    limitations.append(
                        f"PR #{pr.get('number')} has a thread with more than 50 comments; nested comment pagination was truncated."
                    )

        page_info = search["pageInfo"]
        if not page_info["hasNextPage"]:
            break
        if page >= max_pages:
            limitations.append(f"Stopped after {max_pages} search pages.")
            break
        after = page_info["endCursor"]

    return {
        "repo": repo,
        "searchQuery": search_query,
        "issueCount": issue_count,
        "pullRequests": prs,
        "limitations": sorted(set(limitations)),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect authored PR reviewThreads JSON with gh api graphql."
    )
    parser.add_argument("--author", help="GitHub login. Defaults to gh api user.")
    parser.add_argument(
        "--repo",
        action="append",
        dest="repos",
        required=True,
        help="Confirmed repository in owner/name form. Repeatable; no default.",
    )
    parser.add_argument(
        "--since-days",
        type=int,
        required=True,
        help="Confirmed PR creation-date lookback in days; no default.",
    )
    parser.add_argument(
        "--output",
        help="Output JSON path. Defaults to stdout.",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=20,
        help="Maximum GraphQL search pages per repo. Default: 20.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.since_days <= 0:
        print("--since-days must be positive", file=sys.stderr)
        return 2
    if args.max_pages <= 0:
        print("--max-pages must be positive", file=sys.stderr)
        return 2

    now = dt.datetime.now(dt.timezone.utc)
    try:
        author = args.author or infer_author()
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1

    repos = args.repos
    since = since_date(args.since_days, now)
    results = []

    for repo in repos:
        try:
            repo_result = collect_repo(repo, author, since, args.max_pages)
            repo_result["status"] = "ok"
        except RuntimeError as error:
            repo_result = {
                "repo": repo,
                "status": "error",
                "error": str(error),
                "pullRequests": [],
                "limitations": ["Repository collection failed; treat coverage as partial."],
            }
        results.append(repo_result)

    output = {
        "generatedAt": now.isoformat(),
        "author": author,
        "sinceDays": args.since_days,
        "sinceDate": since,
        "repos": repos,
        "results": results,
    }

    rendered = json.dumps(output, indent=2, sort_keys=True)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as output_file:
            output_file.write(rendered)
            output_file.write("\n")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
