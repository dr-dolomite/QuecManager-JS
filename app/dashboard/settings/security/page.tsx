"use client";

import React, { useState, FormEvent, ChangeEvent } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface FormData {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ApiResponse {
  state: string;
  message: string;
}

const SecurityPage = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formData, setFormData] = useState<FormData>({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const validatePassword = async (password: string): Promise<boolean> => {
    try {
      const response = await fetch("/cgi-bin/auth.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `password=${encodeURIComponent(password)}`,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      let data: ApiResponse;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse JSON:", text);
        throw new Error("Invalid response format");
      }
      
      return data.state === "success";
    } catch (error) {
      console.error("Password verification failed:", error);
      return false;
    }
  };

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate form
      if (
        !formData.oldPassword ||
        !formData.newPassword ||
        !formData.confirmPassword
      ) {
        throw new Error("All fields are required");
      }

      if (formData.newPassword !== formData.confirmPassword) {
        throw new Error("New passwords don't match");
      }

      if (formData.newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters long");
      }

      // Verify old password
      const isOldPasswordValid = await validatePassword(formData.oldPassword);
      if (!isOldPasswordValid) {
        throw new Error("Current password is incorrect");
      }

      // Change password
      const response = await fetch("/cgi-bin/settings/change-password.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `oldPassword=${encodeURIComponent(
          formData.oldPassword
        )}&newPassword=${encodeURIComponent(formData.newPassword)}`,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      let data: ApiResponse;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse JSON:", text);
        throw new Error("Invalid response format");
      }

      if (data.state === "success") {
        toast({
          title: "Success",
          description: data.message || "Password changed successfully!",
        });
        setFormData({ oldPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        throw new Error(data.message || "Failed to change password");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
      console.error("Password change failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Device Password</CardTitle>
        <CardDescription>
          This changes the password for the web interface and terminal access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Old Password"
            type="password"
            name="oldPassword"
            value={formData.oldPassword}
            onChange={handleChange}
            aria-label="Old Password"
          />
          <Input
            placeholder="New Password"
            type="password"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleChange}
            aria-label="New Password"
          />
          <Input
            placeholder="Confirm New Password"
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            aria-label="Confirm New Password"
          />
        </form>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button
          type="submit"
          onClick={(e) => handleSubmit(e)}
          disabled={isLoading}
        >
          {isLoading ? "Saving..." : "Save"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SecurityPage;