-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'END_USER', 'DELIVERY', 'CASHIER', 'KITCHEN', 'HALL_MANAGER');

-- CreateEnum
CREATE TYPE "public"."ShiftType" AS ENUM ('MORNING', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "public"."ItemType" AS ENUM ('CONSUMABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "public"."TableType" AS ENUM ('DOUBLE', 'TRIPLE', 'QUAD', 'FAMILY');

-- CreateEnum
CREATE TYPE "public"."TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING');

-- CreateEnum
CREATE TYPE "public"."ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."PartyLocationType" AS ENUM ('RESTAURANT', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "public"."PartyServiceType" AS ENUM ('COOKING_ONLY', 'FULL_SERVICE');

-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY', 'PARTY', 'OPEN_BUFFET');

-- CreateEnum
CREATE TYPE "public"."CustomerType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."OrderItemStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'SERVED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'CARD', 'DIGITAL_WALLET');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."MovementType" AS ENUM ('SUPPLY', 'WASTE', 'SALE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."EndCondition" AS ENUM ('TIME_BASED', 'QUANTITY_BASED', 'BOTH');

-- CreateEnum
CREATE TYPE "public"."DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "public"."ReportType" AS ENUM ('INVENTORY', 'SALES', 'TAXES', 'ORDERS_TIMING', 'SUPPLIES', 'WASTE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."DataType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'END_USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "delivery_area_id" INTEGER,
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "last_order_date" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."company_customers" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "company_name" TEXT NOT NULL,
    "tax_number" TEXT NOT NULL,
    "commercial_register" TEXT,
    "national_address" TEXT,
    "contact_person" TEXT,
    "contact_phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."staff" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "employee_code" TEXT NOT NULL,
    "salary" DECIMAL(65,30),
    "hire_date" TIMESTAMP(3) NOT NULL,
    "shift_type" "public"."ShiftType",
    "is_on_duty" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."delivery_areas" (
    "id" SERIAL NOT NULL,
    "area_name" TEXT NOT NULL,
    "delivery_fee" DECIMAL(65,30) NOT NULL,
    "estimated_delivery_time_minutes" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "delivery_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."units" (
    "id" SERIAL NOT NULL,
    "unit_name_ar" TEXT NOT NULL,
    "unit_name_en" TEXT NOT NULL,
    "unit_symbol" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."items" (
    "id" SERIAL NOT NULL,
    "item_code" TEXT NOT NULL,
    "item_name_ar" TEXT NOT NULL,
    "item_name_en" TEXT NOT NULL,
    "description" TEXT,
    "unit_id" INTEGER NOT NULL,
    "item_type" "public"."ItemType" NOT NULL,
    "cost_price" DECIMAL(65,30) NOT NULL,
    "selling_price" DECIMAL(65,30) NOT NULL,
    "current_stock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "min_stock_level" DECIMAL(65,30) NOT NULL,
    "calories_per_unit" INTEGER,
    "image_url" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."recipes" (
    "id" SERIAL NOT NULL,
    "recipe_code" TEXT NOT NULL,
    "recipe_name_ar" TEXT NOT NULL,
    "recipe_name_en" TEXT NOT NULL,
    "description" TEXT,
    "total_cost" DECIMAL(65,30) NOT NULL,
    "selling_price" DECIMAL(65,30) NOT NULL,
    "preparation_time_minutes" INTEGER NOT NULL,
    "total_calories" INTEGER,
    "image_url" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."recipe_items" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit_cost" DECIMAL(65,30) NOT NULL,
    "total_cost" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."meals" (
    "id" SERIAL NOT NULL,
    "meal_code" TEXT NOT NULL,
    "meal_name_ar" TEXT NOT NULL,
    "meal_name_en" TEXT NOT NULL,
    "description" TEXT,
    "total_cost" DECIMAL(65,30) NOT NULL,
    "selling_price" DECIMAL(65,30) NOT NULL,
    "preparation_time_minutes" INTEGER NOT NULL,
    "total_calories" INTEGER,
    "image_url" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."meal_recipes" (
    "id" SERIAL NOT NULL,
    "meal_id" INTEGER NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "cost" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "meal_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."meal_items" (
    "id" SERIAL NOT NULL,
    "meal_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "cost" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "meal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cooking_methods" (
    "id" SERIAL NOT NULL,
    "method_name_ar" TEXT NOT NULL,
    "method_name_en" TEXT NOT NULL,
    "description" TEXT,
    "cooking_time_minutes" INTEGER NOT NULL,
    "additional_cost" DECIMAL(65,30) NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cooking_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tables" (
    "id" SERIAL NOT NULL,
    "table_number" TEXT NOT NULL,
    "table_type" "public"."TableType" NOT NULL,
    "table_status" "public"."TableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "capacity" INTEGER NOT NULL,
    "location_description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."table_reservations" (
    "id" SERIAL NOT NULL,
    "table_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "reservation_datetime" TIMESTAMP(3) NOT NULL,
    "party_size" INTEGER NOT NULL,
    "status" "public"."ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "special_requests" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "table_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."party_types" (
    "id" SERIAL NOT NULL,
    "type_name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "price_per_person" DECIMAL(65,30) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."party_orders" (
    "id" SERIAL NOT NULL,
    "party_type_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "number_of_people" INTEGER NOT NULL,
    "event_datetime" TIMESTAMP(3) NOT NULL,
    "location_type" "public"."PartyLocationType" NOT NULL,
    "service_type" "public"."PartyServiceType" NOT NULL,
    "total_amount" DECIMAL(65,30) NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "special_requests" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."open_buffet" (
    "id" SERIAL NOT NULL,
    "buffet_name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "entry_price_per_person" DECIMAL(65,30) NOT NULL,
    "max_capacity" INTEGER NOT NULL,
    "buffet_date" TIMESTAMP(3) NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "current_bookings" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "open_buffet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."buffet_bookings" (
    "id" SERIAL NOT NULL,
    "buffet_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "number_of_people" INTEGER NOT NULL,
    "total_amount" DECIMAL(65,30) NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "booking_datetime" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buffet_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."offers" (
    "id" SERIAL NOT NULL,
    "offer_name" TEXT NOT NULL,
    "description" TEXT,
    "start_datetime" TIMESTAMP(3) NOT NULL,
    "end_datetime" TIMESTAMP(3) NOT NULL,
    "max_quantity" INTEGER,
    "used_quantity" INTEGER NOT NULL DEFAULT 0,
    "end_condition" "public"."EndCondition" NOT NULL,
    "discount_type" "public"."DiscountType" NOT NULL,
    "discount_value" DECIMAL(65,30) NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suppliers" (
    "id" SERIAL NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "tax_number" TEXT,
    "commercial_register" TEXT,
    "national_address" TEXT,
    "representative_name" TEXT,
    "representative_phone" TEXT,
    "contact_email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supply_invoices" (
    "id" SERIAL NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "tax_amount" DECIMAL(65,30) NOT NULL,
    "total_amount" DECIMAL(65,30) NOT NULL,
    "invoice_image_url" TEXT,
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_staff_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supply_invoice_items" (
    "id" SERIAL NOT NULL,
    "supply_invoice_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit_cost" DECIMAL(65,30) NOT NULL,
    "total_cost" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "supply_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."waste_requests" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "requested_by_staff_id" INTEGER NOT NULL,
    "waste_quantity" DECIMAL(65,30) NOT NULL,
    "reason" TEXT,
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_admin_id" INTEGER,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "admin_notes" TEXT,

    CONSTRAINT "waste_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_movements" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "movement_type" "public"."MovementType" NOT NULL,
    "quantity_change" DECIMAL(65,30) NOT NULL,
    "quantity_before" DECIMAL(65,30) NOT NULL,
    "quantity_after" DECIMAL(65,30) NOT NULL,
    "reference_id" INTEGER,
    "reference_type" TEXT,
    "created_by_staff_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" SERIAL NOT NULL,
    "order_number" TEXT NOT NULL,
    "customer_id" INTEGER,
    "company_id" INTEGER,
    "table_id" INTEGER,
    "cashier_id" INTEGER,
    "kitchen_staff_id" INTEGER,
    "hall_manager_id" INTEGER,
    "delivery_staff_id" INTEGER,
    "order_type" "public"."OrderType" NOT NULL,
    "customer_type" "public"."CustomerType" NOT NULL,
    "order_status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(65,30) NOT NULL,
    "tax_amount" DECIMAL(65,30) NOT NULL,
    "delivery_fee" DECIMAL(65,30),
    "discount_amount" DECIMAL(65,30),
    "total_amount" DECIMAL(65,30) NOT NULL,
    "order_datetime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "kitchen_start_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "served_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "estimated_ready_time" TIMESTAMP(3),
    "estimated_delivery_time" TIMESTAMP(3),
    "special_instructions" TEXT,
    "cancellation_reason" TEXT,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_reference_id" INTEGER NOT NULL,
    "cooking_method_id" INTEGER,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit_price" DECIMAL(65,30) NOT NULL,
    "total_price" DECIMAL(65,30) NOT NULL,
    "special_instructions" TEXT,
    "status" "public"."OrderItemStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_status_history" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "old_status" "public"."OrderStatus" NOT NULL,
    "new_status" "public"."OrderStatus" NOT NULL,
    "changed_by_staff_id" INTEGER NOT NULL,
    "notes" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "payment_method" "public"."PaymentMethod" NOT NULL,
    "amount_paid" DECIMAL(65,30) NOT NULL,
    "payment_status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_reference" TEXT,
    "payment_datetime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoices" (
    "id" SERIAL NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "order_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "company_id" INTEGER,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "vat_amount" DECIMAL(65,30) NOT NULL,
    "total_amount" DECIMAL(65,30) NOT NULL,
    "qr_code" TEXT,
    "invoice_data_xml" TEXT,
    "invoice_status" "public"."InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "issue_datetime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "zatca_uuid" TEXT,
    "is_simplified" BOOLEAN NOT NULL DEFAULT true,
    "cancellation_reason" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoice_items" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "item_description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit_price" DECIMAL(65,30) NOT NULL,
    "vat_rate" DECIMAL(65,30) NOT NULL,
    "vat_amount" DECIMAL(65,30) NOT NULL,
    "total_amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reports" (
    "id" SERIAL NOT NULL,
    "report_name" TEXT NOT NULL,
    "report_type" "public"."ReportType" NOT NULL,
    "report_date_from" TIMESTAMP(3),
    "report_date_to" TIMESTAMP(3),
    "generated_by_staff_id" INTEGER NOT NULL,
    "report_parameters_json" TEXT,
    "report_data_json" TEXT,
    "file_path" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "table_name" TEXT,
    "record_id" INTEGER,
    "old_values" TEXT,
    "new_values" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."settings" (
    "id" SERIAL NOT NULL,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT NOT NULL,
    "description" TEXT,
    "data_type" "public"."DataType" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_user_id_key" ON "public"."customers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_id_key" ON "public"."staff"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_employee_code_key" ON "public"."staff"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "items_item_code_key" ON "public"."items"("item_code");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_recipe_code_key" ON "public"."recipes"("recipe_code");

-- CreateIndex
CREATE UNIQUE INDEX "meals_meal_code_key" ON "public"."meals"("meal_code");

-- CreateIndex
CREATE UNIQUE INDEX "tables_table_number_key" ON "public"."tables"("table_number");

-- CreateIndex
CREATE UNIQUE INDEX "supply_invoices_invoice_number_key" ON "public"."supply_invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "public"."orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "public"."invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_order_id_key" ON "public"."invoices"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_setting_key_key" ON "public"."settings"("setting_key");

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_delivery_area_id_fkey" FOREIGN KEY ("delivery_area_id") REFERENCES "public"."delivery_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."company_customers" ADD CONSTRAINT "company_customers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."items" ADD CONSTRAINT "items_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."recipe_items" ADD CONSTRAINT "recipe_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."recipe_items" ADD CONSTRAINT "recipe_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meal_recipes" ADD CONSTRAINT "meal_recipes_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meal_recipes" ADD CONSTRAINT "meal_recipes_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meal_items" ADD CONSTRAINT "meal_items_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meal_items" ADD CONSTRAINT "meal_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."table_reservations" ADD CONSTRAINT "table_reservations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."table_reservations" ADD CONSTRAINT "table_reservations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."party_orders" ADD CONSTRAINT "party_orders_party_type_id_fkey" FOREIGN KEY ("party_type_id") REFERENCES "public"."party_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."party_orders" ADD CONSTRAINT "party_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."buffet_bookings" ADD CONSTRAINT "buffet_bookings_buffet_id_fkey" FOREIGN KEY ("buffet_id") REFERENCES "public"."open_buffet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."buffet_bookings" ADD CONSTRAINT "buffet_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supply_invoices" ADD CONSTRAINT "supply_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supply_invoices" ADD CONSTRAINT "supply_invoices_approved_by_staff_id_fkey" FOREIGN KEY ("approved_by_staff_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supply_invoice_items" ADD CONSTRAINT "supply_invoice_items_supply_invoice_id_fkey" FOREIGN KEY ("supply_invoice_id") REFERENCES "public"."supply_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supply_invoice_items" ADD CONSTRAINT "supply_invoice_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_requests" ADD CONSTRAINT "waste_requests_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_requests" ADD CONSTRAINT "waste_requests_requested_by_staff_id_fkey" FOREIGN KEY ("requested_by_staff_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waste_requests" ADD CONSTRAINT "waste_requests_approved_by_admin_id_fkey" FOREIGN KEY ("approved_by_admin_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_created_by_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."company_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_kitchen_staff_id_fkey" FOREIGN KEY ("kitchen_staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_hall_manager_id_fkey" FOREIGN KEY ("hall_manager_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_delivery_staff_id_fkey" FOREIGN KEY ("delivery_staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_cooking_method_id_fkey" FOREIGN KEY ("cooking_method_id") REFERENCES "public"."cooking_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_status_history" ADD CONSTRAINT "order_status_history_changed_by_staff_id_fkey" FOREIGN KEY ("changed_by_staff_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."company_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_generated_by_staff_id_fkey" FOREIGN KEY ("generated_by_staff_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."system_logs" ADD CONSTRAINT "system_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
