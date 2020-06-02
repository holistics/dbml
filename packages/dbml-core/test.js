import Parser from "./src/parse/Parser";
import ModelExporter from "./src/export/ModelExporter";

const dbml = `Table "BandMember" {
  "MusicianId" int [pk, not null]
  "BandId" int [pk, not null, note:'This is a note in column of table 1']

  note: 'something in chinese'
}

Table "MembershipPeriod" {
  "MembershipPeriodId" int [pk, not null]
  "MusicianId" int [not null]
  "BandId" int [not null]
  "StartDate" date [not null]
  "EndDate" date [note: 'original 漢字  simplified 汉字 japanese かんじ korean 한자']

  note: 'Note of table 2'
}

Ref: MembershipPeriod.MusicianId - BandMember.MusicianId
Ref: MembershipPeriod.BandId - BandMember.BandId

Project DBML {
  Note: '''
    # DBML - Database Markup Language
    DBML (database markup language) is a simple, readable DSL language designed to define database structures.

    ## Benefits
    
    * It is simple, flexible and highly human-readable
    * It is database agnostic, focusing on the essential database structure definition without worrying about the detailed syntaxes of each database
    * Comes with a free, simple database visualiser at [dbdiagram.io](http://dbdiagram.io)
  '''
}
`;

const db = Parser.parse(dbml, 'dbml');
// const dbNormalize = JSON.stringify(db.normalize(), null, 2);
// console.log(dbNormalize);
console.log(ModelExporter.export(db, 'mssql', false));
