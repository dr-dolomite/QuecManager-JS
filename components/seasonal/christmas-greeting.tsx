"use client";

import React, { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const ChristmasGreeting = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if it's December 25th
    const today = new Date();
    const isChristmas = today.getMonth() === 11 && today.getDate() === 25;

    if (!isChristmas) {
      return;
    }

    // Check if the greeting has already been shown this year
    const currentYear = today.getFullYear();
    const shownYear = localStorage.getItem("christmasGreetingShown");

    // Show the dialog only if it hasn't been shown this year
    if (shownYear !== currentYear.toString()) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    // Mark as shown for this year
    const currentYear = new Date().getFullYear();
    localStorage.setItem("christmasGreetingShown", currentYear.toString());
    setIsOpen(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Sparkles className="h-16 w-16 text-red-500 animate-pulse" />
              <Sparkles
                className="h-8 w-8 text-yellow-500 absolute top-0 right-0 animate-pulse"
                style={{ animationDelay: "0.3s" }}
              />
              <Sparkles
                className="h-6 w-6 text-green-500 absolute bottom-0 left-0 animate-pulse"
                style={{ animationDelay: "0.6s" }}
              />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-2xl">
            🎄 Merry Christmas and Happy Holidays from QuecManager! 🎅
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-3 pt-4">
            <p className="text-base font-semibold">
              Wishing you joy, peace, and wonderful memories this holiday
              season! May your network connections be strong and your signal
              always excellent! 📶
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button onClick={handleClose} className="w-full">
            Thank you! 🎉
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ChristmasGreeting;
