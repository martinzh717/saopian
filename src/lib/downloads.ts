/** Download artifact names and public paths (under basePath). */
export const DOWNLOADS = {
  macArm64: {
    label: "Mac（Apple 芯片）",
    file: "saopian-macos-arm64.zip",
    href: "/downloads/saopian-macos-arm64.zip",
    platform: "mac-arm64",
  },
  macX64: {
    label: "Mac（Intel）",
    file: "saopian-macos-x64.zip",
    href: "/downloads/saopian-macos-x64.zip",
    platform: "mac-x64",
  },
  winX64: {
    label: "Windows",
    file: "saopian-windows-x64.zip",
    href: "/downloads/saopian-windows-x64.zip",
    platform: "win-x64",
  },
} as const;
