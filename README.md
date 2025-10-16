# MetaManager

A system for receiving applications from potential community organizers and processing them.

## Running

```sh
# Build
podman build -t metamanager .

# Run with env variables
podman run -p 7532:7532 \
  -e SECRET_KEY="392c0cb590001834556988e936a0d667d42830ecbba696a7a497215ac8d7a956" \
  -e ADMIN_ROOM="7041060692428635" \
  -e ADMIN_RELAY="myrelay.example.com" \
  -e ADMIN_PUBKEYS="36d85c480b85e0d29ab8ac127d2a9c596ef70f4e5ee7a5b4301019ca895e6807" \
  -e RELAY_DOMAIN="example.com" \
  -v /path/to/data:/app/data \
  -v /path/to/zooid/config:/app/config \
  metamanager

# Run using environment file
podman run -p 7532:7532 \
  --env-file .env \
  -v /path/to/data:/app/data \
  -v /path/to/zooid/config:/app/config \
  metamanager
```
