Table "departments" {
  "id" integer [pk]
  "name" nvarchar2(255)
  "budget" "number(10, 2)"
}

Table "employees" {
  "id" integer [pk]
  "dept_id" integer
  "name" nvarchar2(255)
}

Records departments(id, name, budget) {
  1, 'Engineering', 500000
  2, 'Marketing', 300000
  3, 'Sales', 400000
  4, 'HR', 250000
}

Records employees(id, dept_id, name) {
  1, 1, 'John Doe'
  2, 1, 'Jane Smith'
  3, 2, 'Bob Johnson'
}
