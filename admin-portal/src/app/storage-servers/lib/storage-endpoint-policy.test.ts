import { describe, expect, it } from "vitest";
import {
  isSafeStorageEndpoint,
  storageEndpointIssue,
} from "./storage-endpoint-policy";

describe("Storage Server endpoint policy", () => {
  it.each([
    "http://localhost:3900",
    "http://127.0.0.1:3900",
    "http://127.255.255.254:3900",
    "http://10.0.0.1:3900",
    "http://172.16.0.1:3900",
    "http://172.31.255.254:3900",
    "http://192.168.222.51:3900",
    "http://[::1]:3900",
  ])("accepts an internal plain-HTTP private origin: %s", (endpoint) => {
    expect(isSafeStorageEndpoint(endpoint, "internal")).toBe(true);
  });

  it.each([
    "http://storage.internal:3900",
    "http://8.8.8.8:3900",
    "http://169.254.169.254:3900",
    "http://172.15.255.255:3900",
    "http://172.32.0.1:3900",
    "http://192.167.255.255:3900",
  ])("rejects a non-private plain-HTTP internal host: %s", (endpoint) => {
    expect(storageEndpointIssue(endpoint, "internal")).toBe(
      "PRIVATE_HTTP_HOST_REQUIRED",
    );
  });

  it("allows an HTTPS internal DNS origin and requires HTTPS publicly", () => {
    expect(
      isSafeStorageEndpoint("https://storage.internal.example:3900", "internal"),
    ).toBe(true);
    expect(
      storageEndpointIssue("http://storage.example.com", "public"),
    ).toBe("PUBLIC_HTTPS_REQUIRED");
    expect(
      isSafeStorageEndpoint("https://storage.example.com", "public"),
    ).toBe(true);
  });

  it.each([
    "https://storage.example.com/s3",
    "https://storage.example.com/?debug=1",
    "https://storage.example.com/#debug",
    "https://user:secret@storage.example.com/",
  ])("rejects a non-origin endpoint: %s", (endpoint) => {
    expect(storageEndpointIssue(endpoint, "public")).toBe(
      "ORIGIN_COMPONENTS_NOT_ALLOWED",
    );
  });
});
