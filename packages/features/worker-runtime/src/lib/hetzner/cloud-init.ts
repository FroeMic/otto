export function renderCloudInit() {
  return `#cloud-config
users:
  - default
  - name: openclaw
    groups:
      - sudo
      - docker
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
package_update: true
packages:
  - docker.io
runcmd:
  - systemctl enable docker
  - systemctl start docker
  - usermod -aG docker openclaw
  - mkdir -p /opt/openclaw
  - chown -R openclaw:openclaw /opt/openclaw
`;
}
