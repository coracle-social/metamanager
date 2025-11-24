# MetaManager

A system for receiving applications from potential community organizers and processing them.

## Usage

A new relay can be requested by sending a POST to the `/apply` endpoint, which accepts a JSON-encoded object with the following parameters:

  `name` - the name of the relay
  `image` - the relay icon
  `schema` - a slug identifying the relay
  `pubkey` - the owner's pubkey
  `description` - the relays description
  `metadata` - additional arbitrary metadata

A message will then be sent to the `ADMIN_ROOM` on `ADMIN_RELAY` notifying admins of the new request. If `REQUIRE_APPROVAL` is configured, an admin must run `/approve <slug>` to approve the request, otherwise it is automatically approved.

Upon approval the relay will exist at `<slug>.<RELAY_DOMAIN>`. A NIP 17 DM will be sent to the applicant `pubkey` containing information for accessing the relay.

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
