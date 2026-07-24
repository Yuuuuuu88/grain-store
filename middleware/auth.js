const jwt = require("jsonwebtoken");

function authenticateAdmin(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "請先登入管理員帳號"
    });
  }

  const token = authorization.substring(7);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "找不到登入憑證"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"]
    });

    req.admin = {
      id: decoded.id,
      username: decoded.username,
      displayName: decoded.displayName,
      role: decoded.role
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "登入已失效，請重新登入"
    });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: "請先登入"
      });
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: "你的管理員等級沒有這項操作權限"
      });
    }

    next();
  };
}

module.exports = {
  authenticateAdmin,
  requireRole
};