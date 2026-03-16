import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateUrl } from "../url-guard.js";

describe("validateUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ROWBOUND_ALLOW_HTTP;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("allows HTTPS URLs", () => {
    expect(() => validateUrl("https://api.example.com/v1")).not.toThrow();
  });

  it("allows http://localhost for dev", () => {
    expect(() => validateUrl("http://localhost:3000/webhook")).not.toThrow();
  });

  it("allows http://127.0.0.1 for dev", () => {
    expect(() => validateUrl("http://127.0.0.1:8080/api")).not.toThrow();
  });

  it("blocks non-HTTPS URLs by default", () => {
    expect(() => validateUrl("http://api.example.com/v1")).toThrow(
      /Non-HTTPS URL blocked/,
    );
  });

  it("allows HTTP when ROWBOUND_ALLOW_HTTP=true", () => {
    process.env.ROWBOUND_ALLOW_HTTP = "true";
    expect(() => validateUrl("http://api.example.com/v1")).not.toThrow();
  });

  it("blocks non-HTTP/HTTPS protocols", () => {
    expect(() => validateUrl("ftp://files.example.com")).toThrow(
      /Unsupported protocol/,
    );
    expect(() => validateUrl("file:///etc/passwd")).toThrow(
      /Unsupported protocol/,
    );
  });

  it("throws on invalid URLs", () => {
    expect(() => validateUrl("not-a-url")).toThrow(/Invalid URL/);
  });

  describe("private IP blocking", () => {
    it("blocks 10.x.x.x range", () => {
      expect(() => validateUrl("https://10.0.0.1/api")).toThrow(
        /private IP address/,
      );
      expect(() => validateUrl("https://10.255.255.255/api")).toThrow(
        /private IP address/,
      );
    });

    it("blocks 172.16-31.x.x range", () => {
      expect(() => validateUrl("https://172.16.0.1/api")).toThrow(
        /private IP address/,
      );
      expect(() => validateUrl("https://172.31.255.255/api")).toThrow(
        /private IP address/,
      );
    });

    it("does not block 172.15.x.x or 172.32.x.x", () => {
      expect(() => validateUrl("https://172.15.0.1/api")).not.toThrow();
      expect(() => validateUrl("https://172.32.0.1/api")).not.toThrow();
    });

    it("blocks 192.168.x.x range", () => {
      expect(() => validateUrl("https://192.168.1.1/api")).toThrow(
        /private IP address/,
      );
    });

    it("blocks 169.254.x.x (cloud metadata)", () => {
      expect(() =>
        validateUrl("https://169.254.169.254/latest/meta-data"),
      ).toThrow(/private IP address/);
    });

    it("blocks 0.0.0.0", () => {
      expect(() => validateUrl("https://0.0.0.0/api")).toThrow(
        /private IP address/,
      );
    });

    it("blocks full 127.0.0.0/8 loopback range", () => {
      expect(() => validateUrl("https://127.0.0.2/api")).toThrow(
        /private IP address/,
      );
      expect(() => validateUrl("https://127.255.255.255/api")).toThrow(
        /private IP address/,
      );
    });

    it("allows public IPs", () => {
      expect(() => validateUrl("https://8.8.8.8/dns")).not.toThrow();
      expect(() => validateUrl("https://1.1.1.1/")).not.toThrow();
    });
  });

  describe("IPv6 private IP blocking", () => {
    it("blocks ::1 (IPv6 loopback)", () => {
      expect(() => validateUrl("https://[::1]/api")).toThrow(
        /private IP address/,
      );
    });

    it("blocks fe80:: (link-local)", () => {
      expect(() => validateUrl("https://[fe80::1]/api")).toThrow(
        /private IP address/,
      );
    });

    it("blocks fc00::/7 (unique local)", () => {
      expect(() => validateUrl("https://[fc00::1]/api")).toThrow(
        /private IP address/,
      );
      expect(() => validateUrl("https://[fd12::1]/api")).toThrow(
        /private IP address/,
      );
    });

    it("blocks ::ffff: mapped private IPv4", () => {
      expect(() => validateUrl("https://[::ffff:10.0.0.1]/api")).toThrow(
        /private IP address/,
      );
      expect(() => validateUrl("https://[::ffff:127.0.0.1]/api")).toThrow(
        /private IP address/,
      );
      expect(() => validateUrl("https://[::ffff:192.168.1.1]/api")).toThrow(
        /private IP address/,
      );
    });

    it("allows ::ffff: mapped public IPv4", () => {
      expect(() => validateUrl("https://[::ffff:8.8.8.8]/api")).not.toThrow();
    });
  });

  describe("numeric/octal IP blocking", () => {
    it("blocks decimal integer for 10.0.0.1 (167772161)", () => {
      // URL class normalizes 167772161 to 10.0.0.1, which isPrivateIpv4 catches
      expect(() => validateUrl("https://167772161/api")).toThrow(
        /private IP address/,
      );
    });

    it("blocks decimal integer for 192.168.1.1 (3232235777)", () => {
      expect(() => validateUrl("https://3232235777/api")).toThrow(
        /private IP address/,
      );
    });

    it("blocks hex for 10.0.0.1 (0x0a000001)", () => {
      expect(() => validateUrl("https://0x0a000001/api")).toThrow(
        /private IP address/,
      );
    });
  });
});
