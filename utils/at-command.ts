/**
 * at-command.ts
 * Utility functions for interacting with the AT command queue system
 */

interface ATQueueResponse {
  command_id?: string;
  status?: string;
  error?: string;
  response?: {
    status: string;
    raw_output: string;
    completion_time: string;
    duration_ms: number;
  };
  command?: {
    id: string;
    text: string;
    timestamp: string;
  };
}

/**
 * Sends AT commands using the queue system client
 * @param command The AT command to send
 * @param waitForResponse Whether to wait for command execution to complete
 * @param timeout Timeout in seconds (default: 30)
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

    // Build the URL with appropriate parameters
    let url = `/cgi-bin/quecmanager/at_cmd/at_queue_client.sh?command=${encodedCommand}`;

    // Add wait parameter if needed
    if (waitForResponse) {
      url += `&wait=1&timeout=${timeout}`;
    }

    // Make the request
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `${localStorage.getItem("authToken")}`, // Use auth token from local storage
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

    // If we're waiting for response, check for completion
    if (waitForResponse && data.response?.status === "timeout") {
      throw new Error(`AT command timed out after ${timeout} seconds`);
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
 * Gets the result of a previously executed command by its ID
 * @param commandId The command ID to check
 * @returns The command result
 */
export const getCommandResult = async (
  commandId: string
): Promise<ATQueueResponse> => {
  try {
    const response = await fetch(
      `/cgi-bin/quecmanager/at_cmd/at_queue_client.sh?command_id=${commandId}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `${localStorage.getItem("authToken")}`, // Use auth token from local storage
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get command result: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting command result:", error);
    throw error;
  }
};

/**
 * Extracts clean output from an AT command response
 * @param response The AT queue response object
 * @returns Clean string output or null if not available
 */
export const extractATCommandOutput = (
  response: ATQueueResponse
): string | null => {
  if (!response || !response.response || !response.response.raw_output) {
    return null;
  }

  const rawOutput = response.response.raw_output;

  // Process the output to remove AT command, OK, and ERROR markers
  let cleanOutput = rawOutput
    .split("\n")
    .filter((line) => {
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
  return response?.response?.status === "success";
};
