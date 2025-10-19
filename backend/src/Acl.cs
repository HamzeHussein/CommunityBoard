using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace WebApp
{
    public static class Acl
    {
        // Tom standard så vi aldrig itererar över null
        private static Arr rules = Arr();

        public static async void Start()
        {
            // Läs regler från db en gång i minuten – krascha aldrig på fel
            while (true)
            {
                try
                {
                    var res = SQLQuery("SELECT * FROM acl ORDER BY allow");
                    UnpackRules(res);
                }
                catch
                {
                    // Om vi inte kan läsa – kör vidare med tomma regler
                    rules = Arr();
                }

                try { await Task.Delay(60000); }
                catch { /* ignore */ }
            }
        }

        public static void UnpackRules(Arr allRules)
        {
            try
            {
                if (allRules == null || allRules.Length == 0)
                {
                    rules = Arr();
                    return;
                }

                // Säkra mappning – fyll i default om kolumn saknas/null
                rules = allRules.Map(r =>
                {
                    var route = (string)(r?.route ?? "");
                    var method = (string)(r?.method ?? "*");
                    var allow = (string)(r?.allow ?? "allow");
                    var match = (string)(r?.match ?? "true");
                    var userRolesStr = (string)(r?.userRoles ?? "");

                    // Gör roller till Arr och trimma
                    var userRoles = (Arr)Arr(
                        userRolesStr.Split(
                            new[] { ',' }, StringSplitOptions.RemoveEmptyEntries
                        )
                    ).Map(x => x.Trim());

                    // Bygg ett enkelt regexmönster (alltid definierat)
                    var regexPattern = @"^" + route.Replace("/", @"\/") + @"\/";

                    // Returnera objekt med EXAKTA fält som Allow() läser
                    return Obj(new
                    {
                        method,
                        regexPattern,
                        userRoles,
                        match,
                        allow
                    });
                });
            }
            catch
            {
                // Gå över till tomma regler på fel
                rules = Arr();
            }
        }

        public static bool Allow(HttpContext context, string method = "", string path = "")
        {
            // ACL av → tillåt allt
            try { if (!Globals.aclOn) return true; }
            catch { return true; }

            // Hämta info om request + user
            method = !string.IsNullOrEmpty(method) ? method : context.Request.Method;
            path = !string.IsNullOrEmpty(path) ? path : context.Request.Path;

            var user = Session.Get(context, "user");
            var userRole = user == null ? "visitor" : user.role;
            var userEmail = user == null ? "" : user.email;

            // Iterera säkert över regler
            var allowed = false;
            Obj appliedAllowRule = null;
            Obj appliedDisallowRule = null;

            var localRules = rules ?? Arr(); // extra säkerhet
            foreach (var rule in localRules)
            {
                try
                {
                    // Läs in fält (de finns alltid med våra defaults i UnpackRules)
                    string ruleMethod = rule.method;
                    string ruleRegexPattern = rule.regexPattern;
                    var ruleRoles = (Arr)rule.userRoles;
                    bool ruleMatch = (rule.match == "true");
                    bool ruleAllow = (rule.allow == "allow");

                    var roleOk = ruleRoles.Includes(userRole);
                    var methodOk = method == ruleMethod || ruleMethod == "*";
                    var pathOk = Regex.IsMatch(path + "/", ruleRegexPattern);
                    // match=false → invertera pathOk
                    pathOk = ruleMatch ? pathOk : !pathOk;

                    var allOk = roleOk && methodOk && pathOk;

                    var oldAllowed = allowed;
                    allowed = ruleAllow ? (allowed || allOk) : (allOk ? false : allowed);

                    if (oldAllowed != allowed)
                    {
                        if (ruleAllow) appliedAllowRule = rule;
                        else appliedDisallowRule = rule;
                    }
                }
                catch
                {
                    // Skippa trasig regel
                    continue;
                }
            }

            // Debuglogg (krascha inte om fält saknas)
            try
            {
                var toLog = Obj(new { userRole, userEmail, aclAllowed = allowed });
                if (Globals.detailedAclDebug && appliedAllowRule != null)
                    toLog.aclAppliedAllowRule = appliedAllowRule;
                if (Globals.detailedAclDebug && appliedDisallowRule != null)
                    toLog.aclAppliedDisallowRule = appliedDisallowRule;
                if (userEmail == "") toLog.Delete("userEmail");
                DebugLog.Add(context, toLog);
            }
            catch { /* ignore */ }

            return allowed;
        }
    }
}
