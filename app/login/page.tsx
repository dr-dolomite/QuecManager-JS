"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/auth";
import { useLuci } from "@/hooks/luci";

import { useToast } from "@/hooks/use-toast";
import GithubButtonToast from "@/components/github-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeftIcon, Eye, EyeOff } from "lucide-react";

const LoginPage = () => {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { login, logout } = useAuth();
  const { luciLogin } = useLuci();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(password);
    if (!success) {
      setError("Invalid password");
    }
  };
  // const handleLuciSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   const success = await luciLogin(password);
  //   if (!success) {
  //     setError("Invalid password");
  //   }
  // };

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-2">
              <a
                href="/"
                className="flex flex-col items-center gap-2 font-medium"
              >
                <img
                  src="/login-logo.svg"
                  alt="QuecManager Logo"
                  className="size-36 aspect-square object-cover"
                />
              </a>
              <h1 className="text-xl font-bold">Welcome to QuecManager</h1>
              <div className="text-center text-sm">
                Forgot your password?{" "}
                <Button
                  variant="link"
                  type="button"
                  className="p-0 underline"
                  onClick={() => {
                    toast({
                      variant: "destructive",
                      title: "Forgot your password?",
                      description:
                        "Use the toolkit script to create a new password.",
                      action: <GithubButtonToast />,
                    });
                  }}
                >
                  Reset it
                </Button>
              </div>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="email">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Button type="submit" className="w-full">
                    Login
                  </Button>
                  <Link href="/" className="flex items-center">
                    <ArrowLeftIcon className="size-4 gap-x-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground underline underline-offset-4">
                      Go Back
                    </p>
                  </Link>
                </div>

                {error && (
                  <div className="bg-rose-500 p-1 rounded-md flex text-center justify-center items-center">
                    <p>{error}</p>
                  </div>
                )}
              </div>
            </form>
            {/* <form onSubmit={handleLuciSubmit}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-3">
                </div>
                <Button type="submit" className="w-full">
                  LuCi Login
                </Button>
                {error && (
                  <div className="bg-rose-500 p-1 rounded-md flex text-center justify-center items-center">
                    <p>{error}</p>
                  </div>
                )}
              </div>
            </form> */}
          </div>

          <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
            By clicking continue, you agree to our{" "}
            <Link
              href="/legal/tos"
              className="text-primary underline underline-offset-4"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/legal/privacy"
              className="text-primary underline underline-offset-4"
            >
              Privacy Policy
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
