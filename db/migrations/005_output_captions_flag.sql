-- Whether captions were burned into this rendered clip. Rendering without captions is supported
-- while captions are not built yet, so each output says honestly what it contains.

-- Up Migration
ALTER TABLE outputs
  ADD COLUMN captions_burned_in boolean NOT NULL DEFAULT false;

-- Down Migration
ALTER TABLE outputs DROP COLUMN captions_burned_in;
