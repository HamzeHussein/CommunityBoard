using System.Text.RegularExpressions;

namespace WebApp;

public static class Acl
{
    private static Arr rules = Arr();

    // Försök ladda regler direkt från Globals.acl.rules
    private static bool TryLoadFromGlobals()
    {
        try
        {
            // Finns en "acl"-nod?
            var acl = Globals.acl;
            if (acl == null) return false;

            // Finns regler?
            var r = (Arr)acl.rules;
            if (r != null && r.Length > 0)
            {
                UnpackRules(r);
                return true;
            }
        }
        catch
        {
            // Ignorera – vi faller tillbaka till DB-läsning
        }
        return false;
    }

    // Körs från Program/App
    public static async void Start()
    {
        // Om regler finns i Globals (via ENV), använd dem och läs inte DB.
        if (TryLoadFromGlobals()) return;

        // Annars läs från DB var 60:e sekund, som tidigare
        while (true)
        {
            try
            {
                UnpackRules(SQLQuery("SELECT * FROM acl ORDER BY allow"));
            }
            catch
            {
                // Om DB inte finns än, använd tom lista tills vidare
                rules = Arr();
            }
            await Task.Delay(60000);
        }
    }

    public static void UnpackRules(Arr allRules)
    {
        // Tomma eller null → tom lista
        if (allRules == null) { rules = Arr(); return; }

        // Normalisera: route → regex, userRoles → array
        rules = allRules.Map(x =>
        {
            string route = "";
            string userRolesStr = "";

            try { route = (string)(x.route ?? ""); } catch { route = ""; }
            try { userRolesStr = (string)(x.userRoles ?? ""); } catch { userRolesStr = ""; }

            var rolesArr =
                ((Arr)Arr(userRolesStr.Split(',', StringSplitOptions.RemoveEmptyEntries)))
                .Map(r => r.Trim());

            var regexPattern = @"^" + route.Replace("/", @"\/") + @"\/";

            return new
            {
                ___ = x,                    // behåll originalraden för ev. debug
                regexPattern,
                userRoles = rolesArr
            };
        });
    }

    public static bool Allow(HttpContext context, string method = "", string path = "")
    {
        // Läsa på/av från nya Globals.acl.on – fallback till gamla Globals.aclOn → false
        bool aclOn = false;
        try
        {
            // Om Globals.acl.on finns, använd den. Annars kolla ev. gammal toppnivå.
            aclOn = (bool)(Globals.acl?.on ?? Globals.aclOn ?? false);
        }
        catch { aclOn = false; }

        // Om ACL är av – allt tillåtet
        if (!aclOn) return true;

        // Request-data
        method = method != "" ? method : context.Request.Method;
        path = path != "" ? path : context.Request.Path;

        var user = Session.Get(context, "user");
        var userRole = user == null ? "visitor" : user.role;
        var userEmail = user == null ? "" : user.email;

        // Gå igenom reglerna
        var allowed = false;
        Obj appliedAllowRule = null;
        Obj appliedDisallowRule = null;

        foreach (var rule in rules)
        {
            string ruleMethod;
            string ruleRegexPattern;
            Arr ruleRoles;
            bool ruleMatch;
            bool ruleAllow;

            try { ruleMethod = (string)rule.method; } catch { ruleMethod = "*"; }
            try { ruleRegexPattern = (string)rule.regexPattern; } catch { ruleRegexPattern = "^/$"; }
            try { ruleRoles = (Arr)rule.userRoles; } catch { ruleRoles = Arr("visitor"); }
            try { ruleMatch = (string)rule.match == "true"; } catch { ruleMatch = true; }
            try { ruleAllow = (string)rule.allow == "allow"; } catch { ruleAllow = false; }

            var roleOk = ruleRoles.Includes(userRole);
            var methodOk = method == ruleMethod || ruleMethod == "*";

            var pathOk = Regex.IsMatch(path + "/", ruleRegexPattern);
            pathOk = ruleMatch ? pathOk : !pathOk; // negation om match=false

            var allOk = roleOk && methodOk && pathOk;

            var oldAllowed = allowed;
            allowed = ruleAllow ? (allowed || allOk) : (allOk ? false : allowed);

            if (oldAllowed != allowed)
            {
                if (ruleAllow) appliedAllowRule = rule;
                else appliedDisallowRule = rule;
            }
        }

        // Logga för felsökning
        var toLog = Obj(new { userRole, userEmail, aclAllowed = allowed });
        if (Globals.detailedAclDebug && appliedAllowRule != null) toLog.aclAppliedAllowRule = appliedAllowRule;
        if (Globals.detailedAclDebug && appliedDisallowRule != null) toLog.aclAppliedDisallowRule = appliedDisallowRule;
        if (userEmail == "") toLog.Delete("userEmail");

        DebugLog.Add(context, toLog);
        return allowed;
    }
}
