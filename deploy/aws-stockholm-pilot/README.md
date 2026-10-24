# Stockholm synthetic-data pilot

This bootstrap runs the reviewed application commit on one Ubuntu 24.04 `t3.small` EC2 instance in `eu-north-1`. It installs PostgreSQL 16 locally, applies V001–V007, creates one synthetic tenant and pilot contributor, and serves the app through Caddy with HTTPS at an `sslip.io` hostname derived from the instance's public IP. It is a disposable demonstration, not the production architecture. The hostname changes if the public IP changes.

The first pilot instance was launched on 24 October 2026. Its HTTPS login page and authenticated tenant workspace were verified. The active hostname and resource IDs are intentionally not recorded in this public repository.

The EC2 instance needs 20 GiB encrypted gp3 storage, outbound internet access, an instance role with `AmazonSSMManagedInstanceCore`, and an inbound security group limited to TCP 80 and 443. Do not open SSH, Node port 3000 or PostgreSQL port 5432. EC2 user data should download this script from a **full reviewed Git commit SHA**, set `SPM_REVISION` to the same SHA, and run it as root. The script itself contains no password or account-specific value.

Bootstrap generates separate random database and role login passwords on the instance. The login details for Executive (`pilot`), Policy, Portfolio Manager and Engagement Lead are in `/root/spm-pilot-access.txt`, readable only through an authorised Systems Manager session. Do not copy them into GitHub, cloud-init output, chat or public logs. Bootstrap progress is in `/var/log/spm-bootstrap.log`; this log must not contain passwords. After launch, check the HTTPS page, role permissions and the four story journeys. Delete the instance, security group, instance profile and pilot IAM role when the demonstration ends, after confirming no data must be retained.

For the existing pilot, apply V008, check out and install the reviewed app revision, run `node /opt/spm/deploy/aws-stockholm-pilot/provision-roles.mjs` as root, then restart `spm`. This preserves the existing `pilot` password and creates three new role accounts. The provisioner saves `/etc/spm/app.env.pre-roles` for rollback. If reverting to the old unrestricted app build, restore that file **before** restarting the old build so new role accounts cannot use its unrestricted commands.

The app has a single in-memory session store and local PostgreSQL. Use only synthetic data. AWS Budgets notifications are not a hard spending cap. The earlier London production residency direction remains open for any real-data deployment.
