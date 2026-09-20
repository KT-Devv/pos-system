-- A realistic single-shop database as it exists today (schema after migrations 002 + 003).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000101', 'legacy.admin@old.test', '{"display_name":"Legacy Admin"}'),
  ('00000000-0000-4000-8000-000000000102', 'legacy.cashier@old.test', '{"display_name":"Legacy Cashier"}');
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000101';

insert into public.categories (id, name) values ('30000000-0000-4000-8000-000000000001', 'Legacy Drinks');
insert into public.products (id, name, category_id, cost_price, selling_price, stock, barcode) values
  ('31000000-0000-4000-8000-000000000001', 'Legacy Water', '30000000-0000-4000-8000-000000000001', 2, 4, 30, '9001'),
  ('31000000-0000-4000-8000-000000000002', 'Legacy Bread', null, 8, 12.5, 10, '9002'),
  ('31000000-0000-4000-8000-000000000003', 'Legacy Soap', null, 3, 6, 5, null);
insert into public.customers (id, name, loyalty_points) values
  ('32000000-0000-4000-8000-000000000001', 'Legacy Kofi', 12),
  ('32000000-0000-4000-8000-000000000002', 'Legacy Ama', 0);
insert into public.suppliers (id, name) values ('33000000-0000-4000-8000-000000000001', 'Legacy Supplier');
insert into public.sales (id, cashier_id, customer_id, subtotal, discount, total, payment_method) values
  ('34000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', '32000000-0000-4000-8000-000000000001', 20.5, 0, 20.5, 'cash'),
  ('34000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000102', null, 6, 0, 6, 'momo');
insert into public.sale_lines (sale_id, product_id, quantity, unit_price, unit_cost) values
  ('34000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 2, 4, 2),
  ('34000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', 1, 12.5, 8),
  ('34000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000003', 1, 6, 3);
insert into public.stock_movements (product_id, type, quantity, supplier_id, notes) values
  ('31000000-0000-4000-8000-000000000001', 'in', 30, '33000000-0000-4000-8000-000000000001', 'opening'),
  ('31000000-0000-4000-8000-000000000001', 'out', 2, null, 'Sale'),
  ('31000000-0000-4000-8000-000000000002', 'out', 1, null, 'Sale'),
  ('31000000-0000-4000-8000-000000000003', 'out', 1, null, 'Sale');
