"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/auth";

import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import GithubButtonToast from "@/components/github-button";
import heartbeat from "@/hooks/heartbeat";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GalleryVerticalEnd } from "lucide-react";

const LoginPage = () => {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, logout } = useAuth();

  const { isServerAlive } = heartbeat();
  useEffect(() => {
    if (!isServerAlive) {
      logout();
    }
  }, [isServerAlive, logout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(password);
    if (!success) {
      setError("Invalid password");
    }
  };

  return (
    // <div className="w-full h-screen lg:grid lg:min-h-[600px] lg:grid-cols-2 gap-4 xl:min-h-[800px]">
    //   <div className="flex items-center justify-center py-12">
    //     <div className="mx-auto grid w-[350px] gap-12">
    //       <div className="grid gap-2 text-center">
    //         <h1 className="text-3xl font-bold">Login to QuecManager</h1>
    //         <p className="text-balance text-muted-foreground">
    //           Enter your password to login
    //         </p>
    //       </div>
    //       <form onSubmit={handleSubmit}>
    //         <div className="grid gap-8">
    //           <div className="grid gap-2">
    //             <div className="flex items-center">
    //               <Label htmlFor="password">Password</Label>
    //             </div>
    //             <Input
    //               id="password"
    //               type="password"
    //               required
    //               value={password}
    //               onChange={(e) => setPassword(e.target.value)}
    //             />
    //             <Button
    //               variant="link"
    //               type="button"
    //               className="ml-auto inline-block text-sm underline text-white"
    //               onClick={() => {
    //                 toast({
    //                   variant: "destructive",
    //                   title: "Forgot your password?",
    //                   description:
    //                     "Use the toolkit script to create a new password.",
    //                   action: <GithubButtonToast />,
    //                 });
    //               }}
    //             >
    //               Forgot your password?
    //             </Button>
    //           </div>
    //           <Button type="submit" className="w-full">
    //             Login
    //           </Button>
    //         </div>
    //         {error && (
    //           <div className="bg-rose-500 p-1 mt-2 rounded-md flex text-center justify-center items-center">
    //             <p>{error}</p>
    //           </div>
    //         )}
    //       </form>
    //     </div>
    //   </div>
    //   <div className="hidden bg-muted lg:block">
    //     <div className="flex h-full w-full items-center justify-center">
    //       <Image
    //         src="/login-logo.svg"
    //         alt="Image"
    //         width="1000"
    //         height="1000"
    //         className="h-[50%] w-[40%] object-contain"
    //       />
    //     </div>
    //   </div>
    // </div>
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <form
            onSubmit={handleSubmit}
          >
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
                  Don&apos;t know the password?{" "}
                  <Button
                    variant="link"
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
              <div className="flex flex-col gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="email">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Login
                </Button>
              </div>
            </div>
          </form>
          <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
            By clicking continue, you agree to our{" "}
            <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
