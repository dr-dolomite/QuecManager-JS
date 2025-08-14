"use client";
import { useRouter } from "next/navigation";


export function useLuci() {
  const router = useRouter();

  async function luciLogin(password: string) {
    const encodedPassword = encodeURIComponent(password);
    try {
      window.location.href = "/cgi-bin/luci?luci_username=root&luci_password=" + encodedPassword;
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  }

  return { luciLogin };
}
