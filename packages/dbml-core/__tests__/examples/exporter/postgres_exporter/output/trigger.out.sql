CREATE TABLE "orders" (
  "id" int PRIMARY KEY,
  "status" varchar,
  "amount" int
);

CREATE OR REPLACE TRIGGER trg_orders_before_insert
  BEFORE INSERT
  ON "public"."orders"
  FOR EACH ROW
  EXECUTE FUNCTION audit_fn();

CREATE OR REPLACE TRIGGER trg_orders_update_check
  AFTER INSERT OR UPDATE OF status, amount
  ON "public"."orders"
  FOR EACH ROW
  WHEN (NEW.amount > 0)
  EXECUTE FUNCTION validate_order();

CREATE OR REPLACE CONSTRAINT TRIGGER trg_fk_check
  AFTER INSERT OR UPDATE
  ON "public"."orders"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION fk_validate_fn();
