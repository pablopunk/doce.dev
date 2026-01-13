#!/bin/bash
set -e

REPO_URL="https://github.com/xxx/yyy"
RUNNER_VERSION="2.330.0"
RUNNER_USER="runner"
RUNNER_DIR="/home/${RUNNER_USER}/actions-runner"
RUNNER_TGZ="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
RUNNER_TOKEN="YYYYYYYYYYYYYYYYYYYYYYYY"

apt update
apt install -y curl git sudo gh


if ! id "${RUNNER_USER}" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "${RUNNER_USER}"
fi

if ! grep -q "^${RUNNER_USER} " /etc/sudoers; then
  echo "${RUNNER_USER} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
fi

mkdir -p "${RUNNER_DIR}"
chown "${RUNNER_USER}:${RUNNER_USER}" "${RUNNER_DIR}"

sudo -u "${RUNNER_USER}" bash <<EOF
set -e
cd "${RUNNER_DIR}"
curl -o "${RUNNER_TGZ}" -L \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_TGZ}"
tar xzf "${RUNNER_TGZ}"
./config.sh \
  --url "${REPO_URL}" \
  --token "${RUNNER_TOKEN}"
EOF

cd "${RUNNER_DIR}"
./svc.sh install
./svc.sh start

./svc.sh status
