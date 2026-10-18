-- Read-only audit for CreatorGear Public's Supabase API dependencies.
-- Run in the Supabase SQL Editor with a role allowed to inspect catalog metadata.
-- This script makes no changes and returns no application rows or credentials.

-- 1. Confirm whether row-level security is enabled on relevant tables.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_catalog.pg_class as c
join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname = any (array[
    'creators', 'products', 'creator_gear', 'product_types',
    'affiliate_links', 'retailers'
  ]::name[])
order by c.relname;

-- 2. Inspect policies and their USING / WITH CHECK expressions.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename = any (array[
    'creators', 'products', 'creator_gear', 'product_types',
    'affiliate_links', 'retailers'
  ])
order by tablename, policyname;

-- 3. Check whether API roles have USAGE on the public schema.
select
  role_name,
  has_schema_privilege(role_name, 'public', 'USAGE') as has_usage
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
order by role_name;

-- 4. Inspect table-level privileges granted to API roles or PUBLIC.
select
  grantee,
  table_name,
  privilege_type,
  is_grantable
from information_schema.table_privileges
where table_schema = 'public'
  and table_name = any (array[
    'creators', 'products', 'creator_gear', 'product_types',
    'affiliate_links', 'retailers'
  ])
  and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
order by table_name, grantee, privilege_type;

-- 5. Inspect any column-level privileges that could allow API reads.
select
  grantee,
  table_name,
  column_name,
  privilege_type,
  is_grantable
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = any (array[
    'creators', 'products', 'creator_gear', 'product_types',
    'affiliate_links', 'retailers'
  ])
  and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
order by table_name, grantee, column_name, privilege_type;
