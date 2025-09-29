// Global settings
var port = args.Length > 0 ? args[0] : "5000";
var frontendPath = args.Length > 1 ? args[1] : "../public";
var dbPath = args.Length > 2 ? args[2] : "_db.sqlite3";

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

Server.Start();

