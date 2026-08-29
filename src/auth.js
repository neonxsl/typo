import { Client, Account, ID, OAuthProvider, Databases, Permission, Query } from "https://cdn.jsdelivr.net/npm/appwrite@16.0.2/+esm";

const client = new Client()
  .setEndpoint("https://api.neonxsl.dev/v1")
  .setProject("69c85bb3001b6430b26a");

export const loginWithGithub = () => {
  const redirectUrl = window.location.origin + window.location.pathname;
  account.createOAuth2Token(
    OAuthProvider.Github,
    redirectUrl,
    redirectUrl
  );
};

export const exchangeOAuthToken = async (userId, secret) => {
  try {
    return await account.createSession(userId, secret);
  } catch (err) {
    console.error("Failed to exchange OAuth token:", err);
    return null;
  }
};

export const account = new Account(client);
export const databases = new Databases(client);

const DB_ID = "typo-db";
const TABLE_ID = "leaderboard";

export const getUserStats = async (userId) => {
    try {
        return await databases.getDocument(DB_ID, TABLE_ID, userId);
    } catch {
        return null;
    }
};

export const getCurrentUser = async () => {
    try {
        const user = await account.get();
        const prefs = await account.getPrefs();
        return { ...user, customUsername: prefs?.customUsername || null };
    } catch {
        return null;
    }

};

export const saveCustomUsername = async (username) => {
    const cleanName = username.trim().toLowerCase();
    await account.updatePrefs({ customUsername: cleanName });
    return cleanName;
};

export const logout = async () => {
    try {
        await account.deleteSession("current");
    } catch (err) {
        console.error("Error logging out:", err);
    }
};

export const syncCloudData = async (data) => {
    try {
        const prefs = await account.getPrefs();
        const merged = { ...prefs };

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith("typo-")) continue;
            const localVal = localStorage.getItem(key);
            const cloudVal = prefs[key];

            if (key.includes("-pb-")) {
                const best = Math.max(Number(localVal) || 0, Number(cloudVal) || 0);
                localStorage.setItem(key, best);
                merged[key] = best;
            }
        }

        const localStreak = Number(localStorage.getItem("typo-streak-count") || 0);
        const cloudStreak = Number(prefs["typo-streak-count"] || 0);
        const bestStreak = Math.max(localStreak, cloudStreak);
        localStorage.setItem("typo-streak-count", bestStreak);
        merged["typo-streak-count"] = bestStreak;

        const localDate = localStorage.getItem("typo-streak-last-date");
        const cloudDate = prefs["typo-streak-last-date"];
        const latestDate = localDate > cloudDate ? localDate : cloudDate;
        if (latestDate) {
            localStorage.setItem("typo-streak-last-date", latestDate);
            merged["typo-streak-last-date"] = latestDate;
        }

        const today = new Date().toISOString().split("T")[0];
        const localDailyDate = localStorage.getItem("typo-daily-date");
        const cloudDailyDate = prefs["typo-daily-date"];

        let bestDailyCount = 0;
        if (localDailyDate === today && cloudDailyDate === today) {
            bestDailyCount = Math.max(Number(localStorage.getItem("typo-daily-count") || 0), Number(prefs["typo-daily-count"] || 0));
        } else if (localDailyDate === today) {
            bestDailyCount = Number(localStorage.getItem("typo-daily-count") || 0);
        } else if (cloudDailyDate === today) {
            bestDailyCount = Number(prefs["typo-daily-count"] || 0);
        }

        localStorage.setItem("typo-daily-count", bestDailyCount);
        localStorage.setItem("typo-daily-date", today);
        merged["typo-daily-count"] = bestDailyCount;
        merged["typo-daily-date"] = today;


        Object.keys(prefs).forEach(key => {
            if (key.startsWith("typo-") && !key.includes("streak") && !key.includes("daily")) {
                if (key.includes("-pb-")) {
                    const best = Math.max(Number(localStorage.getItem(key)) || 0, Number(prefs[key]) || 0);
                    localStorage.setItem(key, best);
                } else {
                    localStorage.setItem(key, prefs[key]);
                }
            }
        });
        await account.updatePrefs(merged);
    } catch (err) {
        console.error("Error syncing cloud data:", err);
    }
};

export const saveCloudKey = async (key, value) => {
    try {
        const prefs = await account.getPrefs();
        await account.updatePrefs({ ...prefs, [key]: value });
    } catch (err) {
        console.error("Error saving cloud key:", err);
    }
};

export const submitToLeaderbaord = async (user, stats, gear, earnedXP, lang, streak) => {
    if (!user || !user.customUsername || stats.wpm <= 0) return null;

    try {
        let existing = null;
        try {
            existing = await databases.getDocument(DB_ID, TABLE_ID, user.$id);
        } catch {

    }

    const currentTotalXP = (existing?.totalXP || 0) + earnedXP;
    const currentLevel = Math.floor(Math.sqrt(currentTotalXP / 100)) + 1;

    const data = {
        username: user.customUsername,
        totalXP: currentTotalXP,
        level: currentLevel,
        streak: streak,
    };

    if (lang === "english") {
        const modeKey = `wpm_${gear.label}`;
        const bestWpm = Math.max(existing?.[modeKey] || 0, stats.wpm);
        data[modeKey] = bestWpm;
    }

    if (existing) {
        await databases.updateDocument(DB_ID, TABLE_ID, user.$id, data);
    } else {
        await databases.createDocument(DB_ID, TABLE_ID, user.$id, data, [Permission.read(Role.any()), Permission.update(Role.user(user.$id)), Permission.delete(Role.user(user.$id))]);

    }
    return {totalXP: currentTotalXP, level: currentLevel};
    } catch (err) {
        console.warn("Error submitting to leaderboard:", err);
    }
};

export const getLeaderboard = async (category = "overall") => {
    try {
        const orderField = category === "overall" ? "totalXP" : `wpm_${category}`;
        const res = await databases.listDocuments(DB_ID, TABLE_ID, [
            Query.orderDesc(orderField),
            Query.greaterThan(orderField, 0),
            Query.limit(30)
        ]);
        return res.documents;
    } catch (err) {
        console.error("Error fetching leaderboard:", err);
        return [];
    }
};