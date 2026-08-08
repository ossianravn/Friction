# Research sources

Only primary and official sources were used for platform decisions.

## Node.js 24

### Filesystem permissions and flags

- Node.js v24 filesystem documentation:
  - https://nodejs.org/download/release/v24.13.1/docs/api/fs.html
  - Windows only implements the write bit through mode/chmod and does not implement the POSIX owner/group/other distinction.
  - `X_OK` has no executable meaning on Windows.
  - Windows does not expose `O_NOFOLLOW` through Node's available open flags.
  - exclusive `x` semantics may not work on network filesystems.
  - per-drive paths such as `C:` and `C:\` have different semantics.

### Child processes

- Node.js v24 child-process documentation:
  - https://nodejs.org/download/release/latest-v24.x/docs/api/child_process.html
  - Windows environment keys are case-insensitive; duplicate `PATH`/`Path` keys are unsafe.
  - `.bat` and `.cmd` files require a shell or explicit `cmd.exe` invocation.
  - `windowsHide` is available for child processes.
  - unsanitized user input must not be passed through a shell.

## Microsoft Windows

### Known folders

- Known Folder identifiers:
  - https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid
  - `FOLDERID_LocalAppData` is the per-user local application-data location represented by `%LOCALAPPDATA%`.

### Windows paths and names

- Naming files, paths, and namespaces:
  - https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
  - Documents UNC, drive-relative paths, device namespaces, case-insensitive defaults, reserved characters, reserved DOS names, trailing spaces/periods, and long-path behavior.

### ACLs

- `icacls` reference:
  - https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/icacls
  - Documents DACL manipulation, SID use, inheritance removal, and object/container inheritance flags.
- `ObjectSecurity.SetAccessRuleProtection`:
  - https://learn.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.objectsecurity.setaccessruleprotection
  - Protected rules cannot be changed through parent inheritance.
- `FileSystemAccessRule`:
  - https://learn.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.filesystemaccessrule.-ctor
  - Provides identity, rights, inheritance, propagation, and allow/deny rule construction.
- `WindowsIdentity.GetCurrent`:
  - https://learn.microsoft.com/en-us/dotnet/api/system.security.principal.windowsidentity.getcurrent
  - Returns the current Windows identity used to obtain the user SID.
- `Get-Acl`:
  - https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/get-acl
  - Returns file/directory security descriptors and SDDL; production code should inspect structured objects, not localized display text.

### PATH/PATHEXT

- `where`:
  - https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/where
  - Appends PATHEXT entries when an extension is omitted.
- `path`:
  - https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/path
  - Documents Windows command search and the default executable extension order.

### PowerShell encoding

- Preference variables:
  - https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_preference_variables
  - `$OutputEncoding` controls text sent to native applications.
- Character encoding:
  - https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding
  - Documents differences between Windows PowerShell 5.1 and current PowerShell encoding behavior.
- `powershell.exe` encoded commands:
  - https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe
  - Documents UTF-16LE Base64 for `-EncodedCommand`.

## Git

- `git rev-parse`:
  - https://git-scm.com/docs/git-rev-parse
  - `--path-format=absolute` produces canonical absolute paths for supported path-reporting options.

## Coding harnesses

- OpenAI Codex app:
  - https://openai.com/index/introducing-the-codex-app/
  - Updated March 4, 2026 to state that the Codex app is available on Windows.
- Anthropic Claude Code setup:
  - https://docs.anthropic.com/en/docs/claude-code/getting-started
  - Documents native Windows operation through Git Bash and Git for Windows.

## GitHub Actions

- GitHub-hosted runners:
  - https://docs.github.com/en/actions/reference/runners/github-hosted-runners
  - Lists `windows-2025` x64 and public-preview Windows ARM64 labels.
- Runner images:
  - https://github.com/actions/runner-images
  - Maps `windows-2025` to the Windows Server 2025 image.
- Checkout action:
  - https://github.com/actions/checkout
  - Current major usage is `actions/checkout@v6`.
- Setup Node action:
  - https://github.com/actions/setup-node/releases
  - Current major usage is `actions/setup-node@v6`.

## Source-to-decision notes

- The ACL plan exists because mode bits are not an equivalent privacy control on Windows.
- The reparse/safe-read plan exists because Node does not expose `O_NOFOLLOW` on Windows.
- The PATH plan exists because npm Windows shims are `.cmd` files and PATHEXT governs extensionless command discovery.
- The PowerShell template explicitly sets UTF-8 so behavior is stable across PowerShell editions.
- The CI plan uses a real Windows runner because Linux mocks cannot validate ACL, NTFS, junction, `.cmd`, or PowerShell behavior.
- The architecture does not claim ARM64 until a real ARM64 acceptance lane passes.
