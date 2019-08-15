create_table = create_table_normal:create_table_normal {
    return {
      command_name: "create_table",
      value: create_table_normal
    }
  }
  / create_table_of:create_table_of {
    return {
      command_name: "create_table",
      value: create_table_of
    }
  }
  / create_table_partition_of:create_table_partition_of {
    return {
      command_name: "create_table",
      value: create_table_partition_of
    }
  }

@import './Create_table_normal.pegjs'
@import './Create_table_of.pegjs'
@import './Create_table_partition_of.pegjs'