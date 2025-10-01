# MetaManager

A system for receiving applications from potential community organizers and processing them.

# Deploying

```sh
# Install pnpm
wget -qO- https://get.pnpm.io/install.sh | sh -

# Install node
pnpm env use --global lts

# Clone and build metamanager
git clone https://github.com/coracle-social/metamanager.git ~/metamanager && cd ~/metamanager
pnpm i && pnpm run build

# Add a service file - edit if needed
cp /home/metamanager/metamanager/metamanager.service /etc/systemd/system/metamanager.service

# Start the service
systemctl enable metamanager
service metamanager start

# Set up nginx - be sure to edit the server_name to your domain
cp /home/metamanager/metamanager/nginx.conf /etc/nginx/sites-available/metamanager.conf
ln -s /etc/nginx/sites-{available,enabled}/metamanager.conf

# Set up TLS
certbot --nginx -d 'yourdomain.com'

# Enable the site and restart nginx
service nginx restart
```

Todo:

- [ ] Add NIP 17 relay onboarding
- [ ] On approval, set up DNS, website, relay, etc
- [ ] On approval/rejection, message community organizer
