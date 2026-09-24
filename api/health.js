// @bolo-db-scaffold
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    db: Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN),
  });
}
