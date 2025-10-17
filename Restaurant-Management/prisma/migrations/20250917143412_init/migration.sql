/*
  Warnings:

  - You are about to drop the column `item_reference_id` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `total_cost` on the `recipe_items` table. All the data in the column will be lost.
  - You are about to drop the column `unit_cost` on the `recipe_items` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tax_number]` on the table `company_customers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[commercial_register]` on the table `company_customers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[meal_id,item_id]` on the table `meal_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[meal_id,recipe_id]` on the table `meal_recipes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[recipe_id,item_id]` on the table `recipe_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tax_number]` on the table `suppliers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[commercial_register]` on the table `suppliers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[supply_invoice_id,item_id]` on the table `supply_invoice_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[unit_symbol]` on the table `units` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `item_type` on the `order_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `cost` to the `recipe_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('ORDER_UPDATE', 'LOW_STOCK', 'PAYMENT_RECEIVED', 'RESERVATION_REMINDER', 'SYSTEM_ALERT', 'WASTE_REQUEST', 'SUPPLY_INVOICE');

-- CreateEnum
CREATE TYPE "public"."SettingCategory" AS ENUM ('SYSTEM', 'PAYMENT', 'TAX', 'NOTIFICATION', 'INVENTORY', 'REPORTING');

-- CreateEnum
CREATE TYPE "public"."OrderItemType" AS ENUM ('ITEM', 'RECIPE', 'MEAL');

-- AlterTable
ALTER TABLE "public"."buffet_bookings" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."company_customers" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."cooking_methods" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."customers" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."delivery_areas" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."invoice_items" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."invoices" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."items" ADD COLUMN     "category_id" INTEGER,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."meal_items" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."meal_recipes" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."meals" ADD COLUMN     "category_id" INTEGER,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."offers" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."open_buffet" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."order_items" DROP COLUMN "item_reference_id",
ADD COLUMN     "item_id" INTEGER,
ADD COLUMN     "meal_id" INTEGER,
ADD COLUMN     "recipe_id" INTEGER,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "item_type",
ADD COLUMN     "item_type" "public"."OrderItemType" NOT NULL;

-- AlterTable
ALTER TABLE "public"."order_status_history" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."orders" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."party_orders" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."party_types" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."payments" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."recipe_items" DROP COLUMN "total_cost",
DROP COLUMN "unit_cost",
ADD COLUMN     "cost" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."recipes" ADD COLUMN     "category_id" INTEGER,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."reports" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."settings" ADD COLUMN     "category" "public"."SettingCategory" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "is_editable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."staff" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."stock_movements" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."suppliers" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."supply_invoice_items" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."supply_invoices" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."system_logs" ADD COLUMN     "user_agent" TEXT;

-- AlterTable
ALTER TABLE "public"."table_reservations" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."tables" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."units" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."waste_requests" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" SERIAL NOT NULL,
    "category_name_ar" TEXT NOT NULL,
    "category_name_en" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."menus" (
    "id" SERIAL NOT NULL,
    "menu_name_ar" TEXT NOT NULL,
    "menu_name_en" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."menu_items" (
    "id" SERIAL NOT NULL,
    "menu_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "item_id" INTEGER,
    "recipe_id" INTEGER,
    "meal_id" INTEGER,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "special_price" DECIMAL(65,30),
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "public"."notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "public"."notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "public"."notifications"("is_read");

-- CreateIndex
CREATE INDEX "categories_is_active_idx" ON "public"."categories"("is_active");

-- CreateIndex
CREATE INDEX "categories_display_order_idx" ON "public"."categories"("display_order");

-- CreateIndex
CREATE INDEX "categories_deleted_at_idx" ON "public"."categories"("deleted_at");

-- CreateIndex
CREATE INDEX "menus_is_active_idx" ON "public"."menus"("is_active");

-- CreateIndex
CREATE INDEX "menus_start_date_end_date_idx" ON "public"."menus"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "menus_deleted_at_idx" ON "public"."menus"("deleted_at");

-- CreateIndex
CREATE INDEX "menu_items_menu_id_idx" ON "public"."menu_items"("menu_id");

-- CreateIndex
CREATE INDEX "menu_items_category_id_idx" ON "public"."menu_items"("category_id");

-- CreateIndex
CREATE INDEX "menu_items_is_available_idx" ON "public"."menu_items"("is_available");

-- CreateIndex
CREATE INDEX "menu_items_deleted_at_idx" ON "public"."menu_items"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_menu_id_item_id_key" ON "public"."menu_items"("menu_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_menu_id_recipe_id_key" ON "public"."menu_items"("menu_id", "recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_menu_id_meal_id_key" ON "public"."menu_items"("menu_id", "meal_id");

-- CreateIndex
CREATE INDEX "buffet_bookings_buffet_id_idx" ON "public"."buffet_bookings"("buffet_id");

-- CreateIndex
CREATE INDEX "buffet_bookings_customer_id_idx" ON "public"."buffet_bookings"("customer_id");

-- CreateIndex
CREATE INDEX "buffet_bookings_booking_datetime_idx" ON "public"."buffet_bookings"("booking_datetime");

-- CreateIndex
CREATE UNIQUE INDEX "company_customers_tax_number_key" ON "public"."company_customers"("tax_number");

-- CreateIndex
CREATE UNIQUE INDEX "company_customers_commercial_register_key" ON "public"."company_customers"("commercial_register");

-- CreateIndex
CREATE INDEX "company_customers_customer_id_idx" ON "public"."company_customers"("customer_id");

-- CreateIndex
CREATE INDEX "company_customers_tax_number_idx" ON "public"."company_customers"("tax_number");

-- CreateIndex
CREATE INDEX "company_customers_deleted_at_idx" ON "public"."company_customers"("deleted_at");

-- CreateIndex
CREATE INDEX "cooking_methods_is_available_idx" ON "public"."cooking_methods"("is_available");

-- CreateIndex
CREATE INDEX "cooking_methods_deleted_at_idx" ON "public"."cooking_methods"("deleted_at");

-- CreateIndex
CREATE INDEX "customers_delivery_area_id_idx" ON "public"."customers"("delivery_area_id");

-- CreateIndex
CREATE INDEX "customers_deleted_at_idx" ON "public"."customers"("deleted_at");

-- CreateIndex
CREATE INDEX "delivery_areas_is_active_idx" ON "public"."delivery_areas"("is_active");

-- CreateIndex
CREATE INDEX "delivery_areas_deleted_at_idx" ON "public"."delivery_areas"("deleted_at");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "public"."invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "invoices_invoice_number_idx" ON "public"."invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_order_id_idx" ON "public"."invoices"("order_id");

-- CreateIndex
CREATE INDEX "invoices_customer_id_idx" ON "public"."invoices"("customer_id");

-- CreateIndex
CREATE INDEX "invoices_issue_datetime_idx" ON "public"."invoices"("issue_datetime");

-- CreateIndex
CREATE INDEX "items_item_code_idx" ON "public"."items"("item_code");

-- CreateIndex
CREATE INDEX "items_category_id_idx" ON "public"."items"("category_id");

-- CreateIndex
CREATE INDEX "items_unit_id_idx" ON "public"."items"("unit_id");

-- CreateIndex
CREATE INDEX "items_item_type_idx" ON "public"."items"("item_type");

-- CreateIndex
CREATE INDEX "items_is_available_idx" ON "public"."items"("is_available");

-- CreateIndex
CREATE INDEX "items_current_stock_idx" ON "public"."items"("current_stock");

-- CreateIndex
CREATE INDEX "items_deleted_at_idx" ON "public"."items"("deleted_at");

-- CreateIndex
CREATE INDEX "meal_items_meal_id_idx" ON "public"."meal_items"("meal_id");

-- CreateIndex
CREATE INDEX "meal_items_item_id_idx" ON "public"."meal_items"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_items_meal_id_item_id_key" ON "public"."meal_items"("meal_id", "item_id");

-- CreateIndex
CREATE INDEX "meal_recipes_meal_id_idx" ON "public"."meal_recipes"("meal_id");

-- CreateIndex
CREATE INDEX "meal_recipes_recipe_id_idx" ON "public"."meal_recipes"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_recipes_meal_id_recipe_id_key" ON "public"."meal_recipes"("meal_id", "recipe_id");

-- CreateIndex
CREATE INDEX "meals_meal_code_idx" ON "public"."meals"("meal_code");

-- CreateIndex
CREATE INDEX "meals_category_id_idx" ON "public"."meals"("category_id");

-- CreateIndex
CREATE INDEX "meals_is_available_idx" ON "public"."meals"("is_available");

-- CreateIndex
CREATE INDEX "meals_deleted_at_idx" ON "public"."meals"("deleted_at");

-- CreateIndex
CREATE INDEX "offers_start_datetime_end_datetime_idx" ON "public"."offers"("start_datetime", "end_datetime");

-- CreateIndex
CREATE INDEX "offers_is_active_idx" ON "public"."offers"("is_active");

-- CreateIndex
CREATE INDEX "offers_target_type_target_id_idx" ON "public"."offers"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "offers_deleted_at_idx" ON "public"."offers"("deleted_at");

-- CreateIndex
CREATE INDEX "open_buffet_buffet_date_idx" ON "public"."open_buffet"("buffet_date");

-- CreateIndex
CREATE INDEX "open_buffet_is_active_idx" ON "public"."open_buffet"("is_active");

-- CreateIndex
CREATE INDEX "open_buffet_deleted_at_idx" ON "public"."open_buffet"("deleted_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "public"."order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_item_id_idx" ON "public"."order_items"("item_id");

-- CreateIndex
CREATE INDEX "order_items_recipe_id_idx" ON "public"."order_items"("recipe_id");

-- CreateIndex
CREATE INDEX "order_items_meal_id_idx" ON "public"."order_items"("meal_id");

-- CreateIndex
CREATE INDEX "order_items_status_idx" ON "public"."order_items"("status");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_idx" ON "public"."order_status_history"("order_id");

-- CreateIndex
CREATE INDEX "order_status_history_changed_by_staff_id_idx" ON "public"."order_status_history"("changed_by_staff_id");

-- CreateIndex
CREATE INDEX "order_status_history_changed_at_idx" ON "public"."order_status_history"("changed_at");

-- CreateIndex
CREATE INDEX "orders_order_number_idx" ON "public"."orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "public"."orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_order_type_idx" ON "public"."orders"("order_type");

-- CreateIndex
CREATE INDEX "orders_order_status_idx" ON "public"."orders"("order_status");

-- CreateIndex
CREATE INDEX "orders_order_datetime_idx" ON "public"."orders"("order_datetime");

-- CreateIndex
CREATE INDEX "orders_is_paid_idx" ON "public"."orders"("is_paid");

-- CreateIndex
CREATE INDEX "orders_order_type_order_status_idx" ON "public"."orders"("order_type", "order_status");

-- CreateIndex
CREATE INDEX "orders_customer_id_order_datetime_idx" ON "public"."orders"("customer_id", "order_datetime");

-- CreateIndex
CREATE INDEX "party_orders_party_type_id_idx" ON "public"."party_orders"("party_type_id");

-- CreateIndex
CREATE INDEX "party_orders_customer_id_idx" ON "public"."party_orders"("customer_id");

-- CreateIndex
CREATE INDEX "party_orders_event_datetime_idx" ON "public"."party_orders"("event_datetime");

-- CreateIndex
CREATE INDEX "party_orders_status_idx" ON "public"."party_orders"("status");

-- CreateIndex
CREATE INDEX "party_types_is_active_idx" ON "public"."party_types"("is_active");

-- CreateIndex
CREATE INDEX "party_types_deleted_at_idx" ON "public"."party_types"("deleted_at");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "public"."payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_payment_method_idx" ON "public"."payments"("payment_method");

-- CreateIndex
CREATE INDEX "payments_payment_status_idx" ON "public"."payments"("payment_status");

-- CreateIndex
CREATE INDEX "payments_payment_datetime_idx" ON "public"."payments"("payment_datetime");

-- CreateIndex
CREATE INDEX "recipe_items_recipe_id_idx" ON "public"."recipe_items"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_items_item_id_idx" ON "public"."recipe_items"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_items_recipe_id_item_id_key" ON "public"."recipe_items"("recipe_id", "item_id");

-- CreateIndex
CREATE INDEX "recipes_recipe_code_idx" ON "public"."recipes"("recipe_code");

-- CreateIndex
CREATE INDEX "recipes_category_id_idx" ON "public"."recipes"("category_id");

-- CreateIndex
CREATE INDEX "recipes_is_available_idx" ON "public"."recipes"("is_available");

-- CreateIndex
CREATE INDEX "recipes_deleted_at_idx" ON "public"."recipes"("deleted_at");

-- CreateIndex
CREATE INDEX "reports_report_type_idx" ON "public"."reports"("report_type");

-- CreateIndex
CREATE INDEX "reports_generated_by_staff_id_idx" ON "public"."reports"("generated_by_staff_id");

-- CreateIndex
CREATE INDEX "reports_generated_at_idx" ON "public"."reports"("generated_at");

-- CreateIndex
CREATE INDEX "settings_category_idx" ON "public"."settings"("category");

-- CreateIndex
CREATE INDEX "settings_setting_key_idx" ON "public"."settings"("setting_key");

-- CreateIndex
CREATE INDEX "staff_employee_code_idx" ON "public"."staff"("employee_code");

-- CreateIndex
CREATE INDEX "staff_shift_type_idx" ON "public"."staff"("shift_type");

-- CreateIndex
CREATE INDEX "staff_is_on_duty_idx" ON "public"."staff"("is_on_duty");

-- CreateIndex
CREATE INDEX "staff_deleted_at_idx" ON "public"."staff"("deleted_at");

-- CreateIndex
CREATE INDEX "stock_movements_item_id_idx" ON "public"."stock_movements"("item_id");

-- CreateIndex
CREATE INDEX "stock_movements_movement_type_idx" ON "public"."stock_movements"("movement_type");

-- CreateIndex
CREATE INDEX "stock_movements_created_at_idx" ON "public"."stock_movements"("created_at");

-- CreateIndex
CREATE INDEX "stock_movements_created_by_staff_id_idx" ON "public"."stock_movements"("created_by_staff_id");

-- CreateIndex
CREATE INDEX "stock_movements_item_id_created_at_idx" ON "public"."stock_movements"("item_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tax_number_key" ON "public"."suppliers"("tax_number");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_commercial_register_key" ON "public"."suppliers"("commercial_register");

-- CreateIndex
CREATE INDEX "suppliers_supplier_name_idx" ON "public"."suppliers"("supplier_name");

-- CreateIndex
CREATE INDEX "suppliers_is_active_idx" ON "public"."suppliers"("is_active");

-- CreateIndex
CREATE INDEX "suppliers_deleted_at_idx" ON "public"."suppliers"("deleted_at");

-- CreateIndex
CREATE INDEX "supply_invoice_items_supply_invoice_id_idx" ON "public"."supply_invoice_items"("supply_invoice_id");

-- CreateIndex
CREATE INDEX "supply_invoice_items_item_id_idx" ON "public"."supply_invoice_items"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "supply_invoice_items_supply_invoice_id_item_id_key" ON "public"."supply_invoice_items"("supply_invoice_id", "item_id");

-- CreateIndex
CREATE INDEX "supply_invoices_invoice_number_idx" ON "public"."supply_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "supply_invoices_supplier_id_idx" ON "public"."supply_invoices"("supplier_id");

-- CreateIndex
CREATE INDEX "supply_invoices_status_idx" ON "public"."supply_invoices"("status");

-- CreateIndex
CREATE INDEX "supply_invoices_invoice_date_idx" ON "public"."supply_invoices"("invoice_date");

-- CreateIndex
CREATE INDEX "system_logs_user_id_idx" ON "public"."system_logs"("user_id");

-- CreateIndex
CREATE INDEX "system_logs_action_idx" ON "public"."system_logs"("action");

-- CreateIndex
CREATE INDEX "system_logs_table_name_idx" ON "public"."system_logs"("table_name");

-- CreateIndex
CREATE INDEX "system_logs_created_at_idx" ON "public"."system_logs"("created_at");

-- CreateIndex
CREATE INDEX "system_logs_table_name_record_id_idx" ON "public"."system_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "table_reservations_table_id_idx" ON "public"."table_reservations"("table_id");

-- CreateIndex
CREATE INDEX "table_reservations_customer_id_idx" ON "public"."table_reservations"("customer_id");

-- CreateIndex
CREATE INDEX "table_reservations_reservation_datetime_idx" ON "public"."table_reservations"("reservation_datetime");

-- CreateIndex
CREATE INDEX "table_reservations_status_idx" ON "public"."table_reservations"("status");

-- CreateIndex
CREATE INDEX "tables_table_number_idx" ON "public"."tables"("table_number");

-- CreateIndex
CREATE INDEX "tables_table_status_idx" ON "public"."tables"("table_status");

-- CreateIndex
CREATE INDEX "tables_is_active_idx" ON "public"."tables"("is_active");

-- CreateIndex
CREATE INDEX "tables_deleted_at_idx" ON "public"."tables"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "units_unit_symbol_key" ON "public"."units"("unit_symbol");

-- CreateIndex
CREATE INDEX "units_is_active_idx" ON "public"."units"("is_active");

-- CreateIndex
CREATE INDEX "units_deleted_at_idx" ON "public"."units"("deleted_at");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "public"."users"("is_active");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "public"."users"("deleted_at");

-- CreateIndex
CREATE INDEX "waste_requests_item_id_idx" ON "public"."waste_requests"("item_id");

-- CreateIndex
CREATE INDEX "waste_requests_requested_by_staff_id_idx" ON "public"."waste_requests"("requested_by_staff_id");

-- CreateIndex
CREATE INDEX "waste_requests_status_idx" ON "public"."waste_requests"("status");

-- CreateIndex
CREATE INDEX "waste_requests_requested_at_idx" ON "public"."waste_requests"("requested_at");

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menu_items" ADD CONSTRAINT "menu_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menu_items" ADD CONSTRAINT "menu_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menu_items" ADD CONSTRAINT "menu_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menu_items" ADD CONSTRAINT "menu_items_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."recipes" ADD CONSTRAINT "recipes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meals" ADD CONSTRAINT "meals_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
