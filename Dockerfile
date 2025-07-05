# Use a Node.js base image for the build stage
FROM node:20-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Copy .env.example as .env for build (provides dummy values to satisfy SvelteKit)
RUN cp .env.example .env

# Build the SvelteKit application
RUN npm run build

# Use a smaller, more secure base image for the final production stage
FROM node:20-alpine AS production

# Set the working directory
WORKDIR /app

# Copy the built application from the builder stage
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose the port the app runs on
EXPOSE 3000

# Set the command to start the application
CMD ["node", "build"]
