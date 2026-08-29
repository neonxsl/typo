import { Client, Account, ID, OAuthProvider } from "https://cdn.jsdelivr.net/npm/appwrite@16.0.2/+esm";

const client = new Client()
  .setEndpoint("https://api.neonxsl.dev/v1")
  .setProject("69c85bb3001b6430b26a");

export const loginWithGithub = () => {
  account.createOAuth2Session(
    OAuthProvider.Github,
    window.location.origin + window.location.pathname,
    window.location.origin + window.location.pathname
  );
};

export const account = new Account(client);

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
            } else {
                merged[key] = cloudVal !== undefined ? cloudVal : localVal;
            }
        }
        Object.keys(prefs).forEach(key => {
            if (!key.startsWith("typo-")) {
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

