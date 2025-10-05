// Stöd både miljövariabler (Render/Docker) och CLI-args (lokalt)

// 1) Läs portar/banor
string port = Environment.GetEnvironmentVariable("PORT")
           ?? (args.Length > 0 ? args[0] : "5000");

string frontendPathRaw = Environment.GetEnvironmentVariable("FRONTEND_PATH")
                      ?? (args.Length > 1 ? args[1] : "../public");

string dbPathRaw = Environment.GetEnvironmentVariable("DB_PATH")
                 ?? (args.Length > 2 ? args[2] : "_db.sqlite3");

// 2) Normalisera ev. relativa sökvägar till absoluta (bra i container)
string baseDir = AppContext.BaseDirectory;
string frontendPath = Path.IsPathRooted(frontendPathRaw)
    ? frontendPathRaw
    : Path.GetFullPath(Path.Combine(baseDir, frontendPathRaw));

string dbPath = Path.IsPathRooted(dbPathRaw)
    ? dbPathRaw
    : Path.GetFullPath(Path.Combine(baseDir, dbPathRaw));

// 3) Dina globala inställningar som tidigare
Globals = Obj(new
{
    debugOn = true,
    detailedAclDebug = false,
    aclOn = false,
    isSpa = true,
    port,
    serverName = "Minimal API Backend",
    frontendPath,
    dbPath,
    sessionLifeTimeHours = 2
});

// 4) Starta som vanligt
Server.Start();
