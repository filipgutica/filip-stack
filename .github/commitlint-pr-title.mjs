// A PR title becomes the squash commit on main, so lint it without commitlint's
// default ignores (merge, revert, version, and fixup headers), which release nothing.
import config from '../commitlint.config.js'

export default { ...config, defaultIgnores: false }
