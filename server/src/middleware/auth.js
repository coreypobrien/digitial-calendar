export const requireAuth = (req, res, next) => {
  if (req.session?.user) {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
};
