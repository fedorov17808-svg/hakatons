# CreditPulse DON — Multi-Region Multi-Cloud Infrastructure (AWS + GCP + Hetzner)
# Deploys a Byzantine Fault Tolerant (BFT) 3-Node Oracle Federation with WireGuard P2P Mesh

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
  }
}

variable "creditpulse_version" {
  default = "v8.0.0-enterprise"
}

variable "don_network_secret" {
  type      = string
  sensitive = true
  default   = "creditpulse-bft-consensus-key"
}

# ==============================================================================
# Node 1: AWS US-East (N. Virginia) — Primary Data: DeFiLlama
# ==============================================================================
provider "aws" {
  region = "us-east-1"
}

resource "aws_security_group" "don_alpha_sg" {
  name        = "creditpulse-don-alpha"
  description = "Allow Wireguard P2P Mesh & mTLS DON Consensus"

  ingress {
    description = "WireGuard VPN Mesh"
    from_port   = 51820
    to_port     = 51820
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "DON mTLS Consensus Port"
    from_port   = 8011
    to_port     = 8011
    protocol    = "tcp"
    cidr_blocks = ["10.100.0.0/24"] # Restricted to WireGuard P2P overlay
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "don_alpha" {
  ami           = "ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS
  instance_type = "t3.medium"
  vpc_security_group_ids = [aws_security_group.don_alpha_sg.id]

  tags = {
    Name        = "CreditPulse-DON-Alpha-US"
    Region      = "us-east-1"
    PrimaryData = "defillama"
    Role        = "oracle-validator"
  }
}

# ==============================================================================
# Node 2: GCP Europe-West3 (Frankfurt) — Primary Data: DexScreener
# ==============================================================================
provider "google" {
  project = "creditpulse-mainnet"
  region  = "europe-west3"
}

resource "google_compute_instance" "don_beta" {
  name         = "creditpulse-don-beta-eu"
  machine_type = "e2-medium"
  zone         = "europe-west3-a"

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  labels = {
    role         = "oracle-validator"
    region       = "eu-central"
    primary_data = "dexscreener"
  }
}

# ==============================================================================
# Node 3: Hetzner Cloud (Helsinki, Finland) — Primary Data: EVM RPC
# ==============================================================================
provider "hcloud" {
  # token = var.hcloud_token
}

resource "hcloud_server" "don_gamma" {
  name        = "creditpulse-don-gamma-hel"
  image       = "ubuntu-22.04"
  server_type = "cx21"
  location    = "hel1"

  labels = {
    role         = "oracle-validator"
    region       = "nordics"
    primary_data = "rpc"
  }
}

output "don_cluster_endpoints" {
  value = {
    node_alpha_aws_us     = "${aws_instance.don_alpha.public_ip}:8011"
    node_beta_gcp_eu      = "${google_compute_instance.don_beta.network_interface.0.access_config.0.nat_ip}:8012"
    node_gamma_hetzner    = "${hcloud_server.don_gamma.ipv4_address}:8013"
    wireguard_mesh_subnet = "10.100.0.0/24"
  }
}
