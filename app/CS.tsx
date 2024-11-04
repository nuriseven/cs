"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

const ChargingStationSimulator: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [chargingState, setChargingState] = useState("Available");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState("ws://127.0.0.1:1880/");
  const [protocol, setProtocol] = useState<"ocpp2.0.1" | "ocpp1.6">(
    "ocpp2.0.1"
  );
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const addLog = useCallback((message: string) => {
    setLogs((prevLogs) => [...prevLogs, message]);
  }, []);

  const sendMessage = useCallback(
    (message: any) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
        addLog(`Sent: ${JSON.stringify(message)}`);
      } else {
        addLog("Not connected to CSMS");
      }
    },
    [addLog]
  );

  const handleIncomingMessage = useCallback(
    (message: any) => {
      if (message.action === "BootNotification") {
        addLog("Boot Notification Confirmed");
      } else if (message.action === "Authorize") {
        addLog("Authorization Confirmed");
      } else if (message.action === "TransactionEvent") {
        addLog(`Transaction ${message.payload.eventType} Confirmed`);
      }
    },
    [addLog]
  );

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    try {
      wsRef.current = new WebSocket(wsUrl, protocol); // Use selected protocol here
      wsRef.current.onopen = () => {
        setConnected(true);
        setError(null);
        addLog(`Connected to CSMS with protocol ${protocol}`);
        sendBootNotification();
      };
      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        addLog(`Received: ${JSON.stringify(message)}`);
        handleIncomingMessage(message);
      };
      wsRef.current.onclose = () => {
        setConnected(false);
        addLog("Disconnected from CSMS");
      };
      wsRef.current.onerror = () => {
        setError("WebSocket error occurred");
        addLog("WebSocket error occurred");
      };
    } catch (err) {
      setError("Invalid WebSocket URL");
      addLog("Invalid WebSocket URL");
    }
  }, [wsUrl, protocol, addLog, handleIncomingMessage]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const sendBootNotification = useCallback(() => {
    const bootNotification = [
      2, // messageTypeId for a call
      Date.now().toString(), // unique message ID
      "BootNotification", // action
      {
        reason: "PowerUp",
        chargingStation: {
          model: "Simulator",
          vendorName: "OCPP Simulator",
        },
      },
    ];
    sendMessage(bootNotification);
  }, [sendMessage]);

  const sendStatusNotification = useCallback(() => {
    const statusNotification = [
      2, // messageTypeId for a call
      Date.now().toString(), // unique message ID
      "StatusNotification", // action
      {
        timestamp: new Date().toISOString(),
        connectorStatus: chargingState,
        evseId: 1,
        connectorId: 1,
      },
    ];
    sendMessage(statusNotification);
  }, [chargingState, sendMessage]);

  const sendAuthorizeRequest = useCallback(() => {
    const authorizeRequest = [
      2, // messageTypeId for a call
      Date.now().toString(), // unique message ID
      "Authorize", // action
      {
        idToken: {
          idToken: "1234567890",
          type: "ISO14443",
        },
      },
    ];
    sendMessage(authorizeRequest);
  }, [sendMessage]);


  
  const sendTransactionEvent = useCallback((eventType: string) => {
    const transactionEvent = [
      2,  // messageTypeId for a call
      Date.now().toString(),  // unique message ID
      'TransactionEvent',  // action
      {
        eventType: eventType,
        timestamp: new Date().toISOString(),
        triggerReason: 'Authorized',
        seqNo: 0,
        transactionInfo: {
          transactionId: transactionId || Date.now().toString()
        },
        evse: {
          id: 1,
          connectorId: 1
        }
      }
    ] as const;  // Using 'as const' to fix the structure
  
    sendMessage(transactionEvent)
  
    // Safely extract transactionId from the payload
    const payload = transactionEvent[3] as {
      eventType: string;
      timestamp: string;
      triggerReason: string;
      seqNo: number;
      transactionInfo: { transactionId: string };
      evse: { id: number; connectorId: number };
    };
  
    if (eventType === 'Started') {
      setTransactionId(payload.transactionInfo.transactionId)
      setChargingState('Charging')
    } else if (eventType === 'Ended') {
      setTransactionId(null)
      setChargingState('Available')
    }
  }, [sendMessage, transactionId])
  

  return (
    <div className="container mx-auto p-4">
      <div className="border rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-4">
          OCPP Charging Station Simulator
        </h1>
        <div className="grid gap-4">
          <div className="space-y-2">
            <label htmlFor="wsUrl" className="block font-medium">
              WebSocket URL
            </label>
            <div className="flex space-x-2">
              <input
                id="wsUrl"
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                placeholder="Enter WebSocket URL"
                className="flex-grow border rounded px-2 py-1"
              />
              <select
                value={protocol}
                onChange={(e) =>
                  setProtocol(e.target.value as "ocpp2.0.1" | "ocpp1.6")
                }
                className="border rounded px-2 py-1"
              >
                <option value="ocpp2.0.1">OCPP 2.0.1</option>
                <option value="ocpp1.6">OCPP 1.6</option>
              </select>
              <button
                onClick={connect}
                disabled={connected}
                className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
              >
                Connect
              </button>
              <button
                onClick={disconnect}
                disabled={!connected}
                className="bg-red-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
              >
                Disconnect
              </button>
            </div>
          </div>
          {error && (
            <div
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded"
              role="alert"
            >
              <p>{error}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">Controls</h2>
              <div className="space-y-2">
                <button
                  onClick={sendStatusNotification} // Call sendStatusNotification directly
                  disabled={!connected}
                  className="bg-green-500 text-white px-4 py-2 rounded w-full disabled:bg-gray-300"
                >
                  Send Status Notification
                </button>

                <button
                  onClick={sendAuthorizeRequest} // Use sendAuthorizeRequest instead of inline object
                  disabled={!connected}
                  className="bg-yellow-500 text-white px-4 py-2 rounded w-full disabled:bg-gray-300"
                >
                  Send Authorize Request
                </button>

                <button
                  onClick={() => sendTransactionEvent("Started")}
                  disabled={!connected || chargingState === "Charging"}
                  className="bg-purple-500 text-white px-4 py-2 rounded w-full disabled:bg-gray-300"
                >
                  Start Transaction
                </button>
                <button
                  onClick={() => sendTransactionEvent("Ended")}
                  disabled={!connected || chargingState !== "Charging"}
                  className="bg-orange-500 text-white px-4 py-2 rounded w-full disabled:bg-gray-300"
                >
                  End Transaction
                </button>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-2">Station Status</h2>
              <div className="space-y-2">
                <div>
                  Connection Status: {connected ? "Connected" : "Disconnected"}
                </div>
                <div>Charging State: {chargingState}</div>
                <div>Transaction ID: {transactionId || "None"}</div>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Logs</h2>
            <div className="bg-gray-100 p-2 h-60 overflow-y-auto border rounded">
              {logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChargingStationSimulator;
