const User = require("../models/User");
const { verifyToken } = require("../utils/authTokens");

function authenticate(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer (.+)$/i);
  const token = match && verifyToken(match[1]);
  if (!token) return res.status(401).json({ success: false, message: "Please sign in to continue." });

  User.findById(token.sub).then((user) => {
    if (!user || (user.tokenVersion || 0) !== token.version) {
      return res.status(401).json({ success: false, message: "Your session has expired. Please sign in again." });
    }
    req.user = user;
    next();
  }).catch(next);
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You do not have permission to perform this action." });
    }
    next();
  };
}

module.exports = { authenticate, requireRoles };
