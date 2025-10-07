/**
 * at-command.ts
 * Utility functions for interacting with the AT command queue system
 * Updated for simplified at_queue_client.sh response format
 */

interface ATQueueResponse {
  command: string;      // The AT command that was executed
  response: string;     // The response from the modem
  status: string;       // "success" or "error"
  error?: string;       // Error message if status is error
}

/**
 * Sends AT commands using the queue system client
 * @param command The AT command to send
 * @param waitForResponse Deprecated - commands now always execute synchronously
 * @param timeout Timeout in seconds (default: 30) - passed to backend
 * @returns Response from the AT queue system
 */
export const atCommandSender = async (
  command: string,
  waitForResponse: boolean = true,
  timeout: number = 30
): Promise<ATQueueResponse> => {
  try {
    // Normalize the command by ensuring it starts with "AT"
    const normalizedCommand = command.trim().toUpperCase().startsWith("AT")
      ? command.trim()
      : `AT${command.trim()}`;

    // Encode the command for URL safety
    const encodedCommand = encodeURIComponent(normalizedCommand);

    // Build the URL with timeout parameter
    // Note: wait parameter removed as all commands now execute synchronously
    let url = `/cgi-bin/quecmanager/at_cmd/at_queue_client.sh?command=${encodedCommand}`;
    
    // Add timeout if specified
    if (timeout !== 30) {
      url += `&timeout=${timeout}`;
    }

    // Make the request
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `${localStorage.getItem("authToken")}`,
      },
      // Set timeout for the fetch request itself
      signal: AbortSignal.timeout(timeout * 1000 + 5000), // Add 5s buffer
    });

    if (!response.ok) {
      throw new Error(`AT command failed with status: ${response.status}`);
    }

    // Parse the JSON response
    const data: ATQueueResponse = await response.json();

    // Handle error in response
    if (data.error) {
      throw new Error(`AT queue error: ${data.error}`);
    }

    // Check if command failed
    if (data.status === "error") {
      throw new Error(`AT command failed: ${data.response || "Unknown error"}`);
    }

    return data;
  } catch (error) {
    console.error("AT Command error:", error);
    throw error; // Re-throw to handle in calling function
  }
};

/**
 * Sends a high-priority AT command (useful for cell scans)
 * @param command The AT command to send
 * @param waitForResponse Whether to wait for command execution to complete
 * @param timeout Timeout in seconds (default: 60 for high-priority commands)
 * @returns Response from the AT queue system
 */
export const sendHighPriorityCommand = async (
  command: string,
  waitForResponse: boolean = true,
  timeout: number = 60
): Promise<ATQueueResponse> => {
  // For QSCAN commands, the queue system automatically assigns high priority
  return atCommandSender(command, waitForResponse, timeout);
};

/**
 * Note: getCommandResult has been removed as the new at_queue_client.sh
 * implementation executes commands synchronously with direct sms_tool execution.
 * All commands now return results immediately.
 */

/**
 * Extracts clean output from an AT command response
 * @param response The AT queue response object
 * @returns Clean string output or null if not available
 */
export const extractATCommandOutput = (
  response: ATQueueResponse
): string | null => {
  if (!response || !response.response) {
    return null;
  }

  const rawOutput = response.response;

  // Process the output to remove AT command, OK, and ERROR markers
  let cleanOutput = rawOutput
    .split("\n")
    .filter((line: string) => {
      // Filter out empty lines, echoed commands, and standard responses
      const trimmedLine = line.trim();
      return (
        trimmedLine &&
        !trimmedLine.startsWith("AT") &&
        trimmedLine !== "OK" &&
        !trimmedLine.startsWith("ERROR")
      );
    })
    .join("\n");

  return cleanOutput || null;
};

/**
 * Checks if an AT command response was successful
 * @param response The AT queue response object
 * @returns Boolean indicating success
 */
export const isATCommandSuccessful = (response: ATQueueResponse): boolean => {
  return response?.status === "success";
};
