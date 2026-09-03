import os
import shutil
import sys


candidate = os.path.abspath("src")
if os.path.isdir(candidate):
    source = "/opt/pluginbench-task/_version.py"
    target = os.path.join(candidate, "_pytest", "_version.py")
    if os.path.isdir(os.path.dirname(target)):
        shutil.copyfile(source, target)
    sys.path.insert(0, candidate)
