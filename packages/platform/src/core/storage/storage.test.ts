/**
 * File Storage Module Tests
 *
 * Tests file upload, download URL generation, deletion, and provider switching.
 * Uses LocalStorageProvider with a temp directory — no S3 config needed.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  initStorage,
  uploadFile,
  getFileUrl,
  deleteFile,
  fileExists,
  getStorageProvider,
  setStorageProvider,
  resetStorage,
  LocalStorageProvider,
  S3StorageProvider,
  type StorageProvider,
} from "./index.js";

const TEST_UPLOADS_DIR = "./test-uploads-" + Date.now();

describe("Storage Module", () => {
  beforeEach(() => {
    resetStorage();
    delete process.env.STORAGE_ENDPOINT;
    delete process.env.STORAGE_BUCKET;
    delete process.env.STORAGE_ACCESS_KEY;
    delete process.env.STORAGE_SECRET_KEY;
  });

  afterEach(async () => {
    // Clean up test upload directory
    try {
      await rm(TEST_UPLOADS_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe("initStorage()", () => {
    it("uses local provider when no STORAGE_ENDPOINT is set", () => {
      initStorage();
      expect(getStorageProvider().name).toBe("local");
    });

    it("uses S3 provider when all storage env vars are set", () => {
      process.env.STORAGE_ENDPOINT = "https://s3.example.com";
      process.env.STORAGE_BUCKET = "test-bucket";
      process.env.STORAGE_ACCESS_KEY = "test-key";
      process.env.STORAGE_SECRET_KEY = "test-secret";
      initStorage();
      expect(getStorageProvider().name).toBe("s3");
    });

    it("falls back to local if only some env vars are set", () => {
      process.env.STORAGE_ENDPOINT = "https://s3.example.com";
      // Missing bucket, keys
      initStorage();
      expect(getStorageProvider().name).toBe("local");
    });
  });

  describe("LocalStorageProvider", () => {
    let provider: LocalStorageProvider;

    beforeEach(() => {
      provider = new LocalStorageProvider(TEST_UPLOADS_DIR, "/api/files");
    });

    it("uploads a file to the local filesystem", async () => {
      const result = await provider.upload({
        key: "test/hello.txt",
        body: Buffer.from("Hello, World!"),
        contentType: "text/plain",
      });

      expect(result.success).toBe(true);
      expect(result.key).toBe("test/hello.txt");
      expect(result.url).toBe("/api/files/test/hello.txt");

      // Verify file exists on disk
      const fileStat = await stat(join(TEST_UPLOADS_DIR, "test/hello.txt"));
      expect(fileStat.isFile()).toBe(true);
    });

    it("creates nested directories automatically", async () => {
      const result = await provider.upload({
        key: "deep/nested/path/file.txt",
        body: "content",
        contentType: "text/plain",
      });

      expect(result.success).toBe(true);
    });

    it("returns a URL for a file", async () => {
      const url = await provider.getUrl("avatars/user-123.png");
      expect(url).toBe("/api/files/avatars/user-123.png");
    });

    it("deletes a file", async () => {
      // Upload first
      await provider.upload({
        key: "to-delete.txt",
        body: "temp",
        contentType: "text/plain",
      });

      const deleted = await provider.delete("to-delete.txt");
      expect(deleted).toBe(true);

      // Verify file is gone
      const exists = await provider.exists("to-delete.txt");
      expect(exists).toBe(false);
    });

    it("returns false when deleting non-existent file", async () => {
      const deleted = await provider.delete("does-not-exist.txt");
      expect(deleted).toBe(false);
    });

    it("checks if a file exists", async () => {
      await provider.upload({
        key: "exists.txt",
        body: "yes",
        contentType: "text/plain",
      });

      expect(await provider.exists("exists.txt")).toBe(true);
      expect(await provider.exists("nope.txt")).toBe(false);
    });

    it("handles string body", async () => {
      const result = await provider.upload({
        key: "string-body.txt",
        body: "This is a string",
        contentType: "text/plain",
      });

      expect(result.success).toBe(true);
    });

    it("handles Uint8Array body", async () => {
      const result = await provider.upload({
        key: "uint8-body.bin",
        body: new Uint8Array([0x00, 0x01, 0x02]),
        contentType: "application/octet-stream",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("S3StorageProvider", () => {
    it("can be instantiated with config", () => {
      const provider = new S3StorageProvider({
        endpoint: "https://s3.example.com",
        bucket: "my-bucket",
        accessKey: "AKID",
        secretKey: "secret",
      });
      expect(provider.name).toBe("s3");
    });

    it("generates URLs with public URL when provided", async () => {
      const provider = new S3StorageProvider({
        endpoint: "https://s3.example.com",
        bucket: "my-bucket",
        accessKey: "AKID",
        secretKey: "secret",
        publicUrl: "https://cdn.example.com",
      });

      const url = await provider.getUrl("images/photo.jpg");
      expect(url).toBe("https://cdn.example.com/images/photo.jpg");
    });

    it("generates URLs with endpoint when no public URL", async () => {
      const provider = new S3StorageProvider({
        endpoint: "https://s3.example.com",
        bucket: "my-bucket",
        accessKey: "AKID",
        secretKey: "secret",
      });

      const url = await provider.getUrl("images/photo.jpg");
      expect(url).toBe("https://s3.example.com/my-bucket/images/photo.jpg");
    });
  });

  describe("Public API", () => {
    it("uploadFile delegates to provider", async () => {
      setStorageProvider(new LocalStorageProvider(TEST_UPLOADS_DIR));

      const result = await uploadFile({
        key: "api-test.txt",
        body: "api content",
        contentType: "text/plain",
      });

      expect(result.success).toBe(true);
    });

    it("getFileUrl delegates to provider", async () => {
      const url = await getFileUrl("test-key.png");
      expect(url).toContain("test-key.png");
    });

    it("deleteFile delegates to provider", async () => {
      setStorageProvider(new LocalStorageProvider(TEST_UPLOADS_DIR));

      await uploadFile({
        key: "to-remove.txt",
        body: "temp",
        contentType: "text/plain",
      });

      const deleted = await deleteFile("to-remove.txt");
      expect(deleted).toBe(true);
    });

    it("fileExists delegates to provider", async () => {
      setStorageProvider(new LocalStorageProvider(TEST_UPLOADS_DIR));

      await uploadFile({
        key: "check-exists.txt",
        body: "check",
        contentType: "text/plain",
      });

      expect(await fileExists("check-exists.txt")).toBe(true);
      expect(await fileExists("nope.txt")).toBe(false);
    });
  });

  describe("setStorageProvider()", () => {
    it("overrides the current provider", () => {
      const custom: StorageProvider = {
        name: "custom",
        upload: async () => ({ key: "", url: "", success: true }),
        getUrl: async () => "",
        delete: async () => true,
        exists: async () => false,
      };

      setStorageProvider(custom);
      expect(getStorageProvider().name).toBe("custom");
    });
  });

  describe("resetStorage()", () => {
    it("resets to default local provider", () => {
      const custom: StorageProvider = {
        name: "custom",
        upload: async () => ({ key: "", url: "", success: true }),
        getUrl: async () => "",
        delete: async () => true,
        exists: async () => false,
      };
      setStorageProvider(custom);
      expect(getStorageProvider().name).toBe("custom");

      resetStorage();
      expect(getStorageProvider().name).toBe("local");
    });
  });
});
