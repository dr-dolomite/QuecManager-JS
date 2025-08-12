"use client";
import { useRouter } from "next/navigation";


export function useLuci() {
  const router = useRouter();

  async function luciLogin(password: string) {
    const encodedPassword = encodeURIComponent(password);
    try {
      const response = await fetch("/cgi-bin/luci", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `luci_username=root&luci_password=${encodedPassword}`,
      });
      const result = await response.text();
      console.log(result);
      if (response.ok && response.url.includes("/cgi-bin/luci")) {
        // router.push("/cgi-bin/luci/");
        window.location.href = "/cgi-bin/luci";
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  }

  // return { isAuthenticated, isServerAlive, login, logout, checkAuth };
  return { luciLogin };
}
