#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/build_llama_server.sh [options]

Build and stage a distributable llama-server bundle, then copy it into
vendor/llama-server/<platform-arch>.

Options:
  --source-dir PATH     Source checkout for llama-cpp-turboquant.
                        Default: third_party/llama-cpp-turboquant
  --build-dir PATH      CMake build directory.
                        Default: <source-dir>/build-distribution
  --stage-dir PATH      Install staging directory.
                        Default: <source-dir>/stage-distribution
  --vendor-dir PATH     Vendor root to populate.
                        Default: vendor/llama-server
  --platform PLATFORM   Target platform name for the vendor directory.
                        Supported: auto, darwin, linux, win32
                        Default: auto
  --arch ARCH           Target architecture for the vendor directory.
                        Supported: auto, x64, arm64
                        Default: auto
  --backend BACKEND     Llama backend to build.
                        Supported: auto, cpu, metal, cuda
                        Default: auto
  --clean               Remove build and stage directories before building
  --help                Show this message

Notes:
  - The script expects the source tree to already be cloned and checked out.
  - It stages llama-server and adjacent shared libraries into one relocatable folder.
  - Platform fixups depend on the current host toolchain. Use macOS for macOS builds,
    Linux for Linux builds, and a Windows shell environment for Windows builds.

Examples:
  scripts/build_llama_server.sh --backend metal --clean
  scripts/build_llama_server.sh --platform linux --backend cuda
  scripts/build_llama_server.sh --platform win32 --backend cpu
EOF
}

detect_host_platform() {
  case "$(uname -s)" in
    Darwin)
      echo "darwin"
      ;;
    Linux)
      echo "linux"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "win32"
      ;;
    *)
      echo "unsupported"
      ;;
  esac
}

detect_host_arch() {
  case "$(uname -m)" in
    x86_64|amd64)
      echo "x64"
      ;;
    arm64|aarch64)
      echo "arm64"
      ;;
    *)
      uname -m
      ;;
  esac
}

default_backend_for_platform() {
  case "$1" in
    darwin)
      echo "metal"
      ;;
    linux|win32)
      echo "cpu"
      ;;
    *)
      echo "cpu"
      ;;
  esac
}

require_tools() {
  local tool
  for tool in "$@"; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo "Missing required tool: $tool" >&2
      exit 1
    fi
  done
}

copy_tree_contents() {
  local src="$1"
  local dst="$2"

  rm -rf "$dst"
  mkdir -p "$dst"
  cp -R "$src"/. "$dst"/
}

copy_bundle_artifacts() {
  local src_dir="$1"
  local dst_dir="$2"
  local exe_name="$3"
  local file

  rm -rf "$dst_dir"
  mkdir -p "$dst_dir"

  cp -f "$src_dir/$exe_name" "$dst_dir/"

  while IFS= read -r file; do
    cp -f "$file" "$dst_dir/"
  done < <(find "$src_dir" -maxdepth 1 -type f \( -name '*.dylib' -o -name '*.so' -o -name '*.so.*' -o -name '*.dll' \) | sort)

  while IFS= read -r file; do
    local base
    local target
    base="$(basename "$file")"
    target="$(readlink "$file")"
    ln -sf "$target" "$dst_dir/$base"
  done < <(find "$src_dir" -maxdepth 1 -type l \( -name '*.dylib' -o -name '*.so' -o -name '*.so.*' -o -name '*.dll' \) | sort)
}

find_bundle_binary() {
  local stage_dir="$1"
  local exe_name="$2"
  local candidate

  for candidate in \
    "$stage_dir/bin/$exe_name" \
    "$stage_dir/$exe_name"
  do
    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

bundle_stage_libraries() {
  local stage_dir="$1"
  local bundle_dir="$2"
  local lib

  while IFS= read -r lib; do
    cp -f "$lib" "$bundle_dir/"
  done < <(find "$stage_dir" -type f \( -name '*.dylib' -o -name '*.so' -o -name '*.so.*' -o -name '*.dll' \) | sort)
}

create_compat_symlinks() {
  local bundle_dir="$1"
  local file

  while IFS= read -r file; do
    local base
    local compat
    base="$(basename "$file")"

    case "$base" in
      *.dylib)
        if [[ "$base" =~ ^([^.]+)\.([0-9]+)(\..+)?\.dylib$ ]]; then
          compat="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.dylib"
        else
          compat=""
        fi
        ;;
      *.so.*)
        if [[ "$base" =~ ^(.+\.so\.([0-9]+))(\..+)+$ ]]; then
          compat="${BASH_REMATCH[1]}"
        else
          compat=""
        fi
        ;;
      *)
        compat=""
        ;;
    esac

    if [[ -n "$compat" && "$compat" != "$base" && ! -e "$bundle_dir/$compat" ]]; then
      ln -s "$base" "$bundle_dir/$compat"
    fi
  done < <(find "$bundle_dir" -maxdepth 1 -type f \( -name '*.dylib' -o -name '*.so.*' \) | sort)
}

copy_common_external_libs() {
  local platform="$1"
  local bundle_dir="$2"
  local src

  case "$platform" in
    darwin)
      for src in \
        /opt/homebrew/opt/openssl@3/lib/libssl.3.dylib \
        /opt/homebrew/opt/openssl@3/lib/libcrypto.3.dylib \
        /usr/local/opt/openssl@3/lib/libssl.3.dylib \
        /usr/local/opt/openssl@3/lib/libcrypto.3.dylib
      do
        if [[ -f "$src" ]]; then
          cp -f "$src" "$bundle_dir/"
        fi
      done
      ;;
  esac
}

fixup_macos_bundle() {
  local bundle_dir="$1"
  local file

  require_tools install_name_tool otool codesign

  while IFS= read -r file; do
    local deps_output
    local base
    base="$(basename "$file")"

    if [[ "$base" == *.dylib ]]; then
      install_name_tool -id "@rpath/$base" "$file"
    fi

    deps_output="$(otool -L "$file")"
    while IFS= read -r dep; do
      [[ -n "$dep" ]] || continue
      case "$dep" in
        /System/*|/usr/lib/*)
          continue
          ;;
      esac
      local dep_base
      dep_base="$(basename "$dep")"
      if [[ -f "$bundle_dir/$dep_base" ]]; then
        install_name_tool -change "$dep" "@loader_path/$dep_base" "$file"
      fi
    done < <(printf '%s\n' "$deps_output" | tail -n +2 | awk '{print $1}' | grep '^/' || true)

    local current_rpaths
    current_rpaths="$(otool -l "$file" | awk '
      $1 == "cmd" && $2 == "LC_RPATH" { in_rpath = 1; next }
      in_rpath && $1 == "path" { print $2; in_rpath = 0 }
    ')"

    while IFS= read -r rpath; do
      [[ -n "$rpath" ]] || continue
      if [[ "$rpath" != "@loader_path" ]]; then
        install_name_tool -delete_rpath "$rpath" "$file"
      fi
    done <<<"$current_rpaths"

    if ! grep -q '^@loader_path$' <<<"$current_rpaths"; then
      install_name_tool -add_rpath @loader_path "$file"
    fi
  done < <(find "$bundle_dir" -maxdepth 1 -type f \( -name 'llama-server' -o -name '*.dylib' \) | sort)

  while IFS= read -r file; do
    local bad_refs
    bad_refs="$(otool -L "$file" | tail -n +2 | awk '{print $1}' | grep '^/' | grep -v '^/System/' | grep -v '^/usr/lib/' || true)"
    if [[ -n "$bad_refs" ]]; then
      echo "Found non-relocatable dependency references in $file:" >&2
      echo "$bad_refs" >&2
      exit 1
    fi
  done < <(find "$bundle_dir" -maxdepth 1 -type f \( -name 'llama-server' -o -name '*.dylib' \) | sort)

  while IFS= read -r file; do
    codesign --force --sign - "$file"
  done < <(find "$bundle_dir" -maxdepth 1 -type f \( -name 'llama-server' -o -name '*.dylib' \) | sort)
}

fixup_linux_bundle() {
  local bundle_dir="$1"
  local file

  require_tools patchelf readelf

  while IFS= read -r file; do
    local base
    base="$(basename "$file")"
    if [[ "$base" == *.so || "$base" == *.so.* ]]; then
      patchelf --set-soname "$base" "$file" || true
    fi
    patchelf --set-rpath '$ORIGIN' "$file"
  done < <(find "$bundle_dir" -maxdepth 1 -type f \( -name 'llama-server' -o -name '*.so' -o -name '*.so.*' \) | sort)

  while IFS= read -r file; do
    local dynamic_info
    dynamic_info="$(readelf -d "$file" || true)"
    if grep -E '(RPATH|RUNPATH)' <<<"$dynamic_info" | grep -v '\$ORIGIN' >/dev/null 2>&1; then
      echo "Found non-relocatable rpath/runpath in $file:" >&2
      echo "$dynamic_info" | grep -E '(RPATH|RUNPATH)' >&2
      exit 1
    fi
  done < <(find "$bundle_dir" -maxdepth 1 -type f \( -name 'llama-server' -o -name '*.so' -o -name '*.so.*' \) | sort)
}

fixup_windows_bundle() {
  local bundle_dir="$1"
  local exe_path="$bundle_dir/llama-server.exe"

  if [[ ! -f "$exe_path" ]]; then
    echo "Expected Windows executable not found: $exe_path" >&2
    exit 1
  fi
}

verify_smoke_test() {
  local exe_path="$1"
  echo "Smoke-testing staged binary..."
  if "$exe_path" --version >/dev/null 2>&1; then
    return 0
  fi
  "$exe_path" -h | head -n 1 >/dev/null
}

print_verification_hints() {
  local platform="$1"
  local target_dir="$2"

  echo
  echo "Vendored llama-server bundle updated at:"
  echo "  $target_dir"
  echo
  echo "Verification:"
  case "$platform" in
    darwin)
      echo "  otool -L \"$target_dir/llama-server\""
      echo "  otool -l \"$target_dir/llama-server\" | rg 'LC_RPATH|path '"
      echo "  \"$target_dir/llama-server\" -h >/dev/null"
      ;;
    linux)
      echo "  readelf -d \"$target_dir/llama-server\" | rg 'RPATH|RUNPATH'"
      echo "  ldd \"$target_dir/llama-server\""
      echo "  \"$target_dir/llama-server\" -h >/dev/null"
      ;;
    win32)
      echo "  \"$target_dir/llama-server.exe\" -h"
      ;;
  esac
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/third_party/llama-cpp-turboquant"
BUILD_DIR=""
STAGE_DIR=""
VENDOR_DIR="$REPO_ROOT/vendor/llama-server"
TARGET_PLATFORM="auto"
TARGET_ARCH="auto"
BACKEND="auto"
CLEAN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-dir)
      SOURCE_DIR="$2"
      shift 2
      ;;
    --build-dir)
      BUILD_DIR="$2"
      shift 2
      ;;
    --stage-dir)
      STAGE_DIR="$2"
      shift 2
      ;;
    --vendor-dir)
      VENDOR_DIR="$2"
      shift 2
      ;;
    --platform)
      TARGET_PLATFORM="$2"
      shift 2
      ;;
    --arch)
      TARGET_ARCH="$2"
      shift 2
      ;;
    --backend)
      BACKEND="$2"
      shift 2
      ;;
    --clean)
      CLEAN=1
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

HOST_PLATFORM="$(detect_host_platform)"
HOST_ARCH="$(detect_host_arch)"

if [[ "$HOST_PLATFORM" == "unsupported" ]]; then
  echo "Unsupported host platform: $(uname -s)" >&2
  exit 1
fi

if [[ "$TARGET_PLATFORM" == "auto" ]]; then
  TARGET_PLATFORM="$HOST_PLATFORM"
fi

if [[ "$TARGET_ARCH" == "auto" ]]; then
  TARGET_ARCH="$HOST_ARCH"
fi

if [[ "$BACKEND" == "auto" ]]; then
  BACKEND="$(default_backend_for_platform "$TARGET_PLATFORM")"
fi

case "$TARGET_PLATFORM" in
  darwin|linux|win32)
    ;;
  *)
    echo "Unsupported platform: $TARGET_PLATFORM" >&2
    exit 1
    ;;
esac

case "$TARGET_ARCH" in
  x64|arm64)
    ;;
  *)
    echo "Unsupported arch: $TARGET_ARCH" >&2
    exit 1
    ;;
esac

case "$BACKEND" in
  cpu|metal|cuda)
    ;;
  *)
    echo "Unsupported backend: $BACKEND" >&2
    exit 1
    ;;
esac

if [[ "$BACKEND" == "metal" && "$TARGET_PLATFORM" != "darwin" ]]; then
  echo "--backend metal is only valid for darwin builds." >&2
  exit 1
fi

if [[ "$TARGET_PLATFORM" != "$HOST_PLATFORM" ]]; then
  echo "Warning: target platform $TARGET_PLATFORM does not match host platform $HOST_PLATFORM." >&2
  echo "This script assumes a native toolchain for the selected platform." >&2
fi

if [[ "$SOURCE_DIR" != /* ]]; then
  SOURCE_DIR="$REPO_ROOT/$SOURCE_DIR"
fi

if [[ "$VENDOR_DIR" != /* ]]; then
  VENDOR_DIR="$REPO_ROOT/$VENDOR_DIR"
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory does not exist: $SOURCE_DIR" >&2
  exit 1
fi

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
BUILD_DIR="${BUILD_DIR:-$SOURCE_DIR/build-distribution-$TARGET_PLATFORM-$TARGET_ARCH-$BACKEND}"
STAGE_DIR="${STAGE_DIR:-$SOURCE_DIR/stage-distribution-$TARGET_PLATFORM-$TARGET_ARCH-$BACKEND}"
VENDOR_DIR="$(cd "$(dirname "$VENDOR_DIR")" && pwd)/$(basename "$VENDOR_DIR")"

require_tools cmake cp find

if [[ $CLEAN -eq 1 ]]; then
  rm -rf "$BUILD_DIR" "$STAGE_DIR"
fi

mkdir -p "$BUILD_DIR" "$STAGE_DIR"

EXE_NAME="llama-server"
if [[ "$TARGET_PLATFORM" == "win32" ]]; then
  EXE_NAME="llama-server.exe"
fi

CMAKE_ARGS=(
  -DCMAKE_BUILD_TYPE=Release
  -DCMAKE_INSTALL_PREFIX="$STAGE_DIR"
  -DGGML_METAL=OFF
  -DGGML_CUDA=OFF
)

case "$TARGET_PLATFORM" in
  darwin)
    CMAKE_ARGS+=(
      -DCMAKE_INSTALL_RPATH=@loader_path
      -DCMAKE_BUILD_WITH_INSTALL_RPATH=ON
    )
    ;;
  linux)
    CMAKE_ARGS+=(
      -DCMAKE_INSTALL_RPATH=\$ORIGIN
      -DCMAKE_BUILD_WITH_INSTALL_RPATH=ON
    )
    ;;
esac

case "$BACKEND" in
  metal)
    CMAKE_ARGS+=(-DGGML_METAL=ON)
    ;;
  cuda)
    CMAKE_ARGS+=(-DGGML_CUDA=ON)
    ;;
esac

echo "Building llama-server from: $SOURCE_DIR"
echo "Build dir: $BUILD_DIR"
echo "Stage dir: $STAGE_DIR"
echo "Platform: $TARGET_PLATFORM"
echo "Arch: $TARGET_ARCH"
echo "Backend: $BACKEND"

cmake -S "$SOURCE_DIR" -B "$BUILD_DIR" "${CMAKE_ARGS[@]}"
cmake --build "$BUILD_DIR" --config Release -j
cmake --install "$BUILD_DIR"

BIN_PATH="$(find_bundle_binary "$STAGE_DIR" "$EXE_NAME" || true)"
if [[ -z "$BIN_PATH" ]]; then
  echo "Could not find staged $EXE_NAME under: $STAGE_DIR" >&2
  exit 1
fi

BUNDLE_DIR="$(dirname "$BIN_PATH")"

bundle_stage_libraries "$STAGE_DIR" "$BUNDLE_DIR"
copy_common_external_libs "$TARGET_PLATFORM" "$BUNDLE_DIR"
create_compat_symlinks "$BUNDLE_DIR"

case "$TARGET_PLATFORM" in
  darwin)
    fixup_macos_bundle "$BUNDLE_DIR"
    ;;
  linux)
    fixup_linux_bundle "$BUNDLE_DIR"
    ;;
  win32)
    fixup_windows_bundle "$BUNDLE_DIR"
    ;;
esac

verify_smoke_test "$BIN_PATH"

TARGET_DIR="$VENDOR_DIR/$TARGET_PLATFORM-$TARGET_ARCH"
copy_bundle_artifacts "$BUNDLE_DIR" "$TARGET_DIR" "$EXE_NAME"

print_verification_hints "$TARGET_PLATFORM" "$TARGET_DIR"
