ALTER TABLE "displays" ADD COLUMN "player_token" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "displays" ADD CONSTRAINT "displays_player_token_unique" UNIQUE("player_token");