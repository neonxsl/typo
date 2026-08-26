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

