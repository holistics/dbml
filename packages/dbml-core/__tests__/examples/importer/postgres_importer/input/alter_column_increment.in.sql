CREATE TABLE public.users (
    id bigint NOT NULL,
    email text NOT NULL
);

CREATE TABLE billing.invoices (
    id integer NOT NULL,
    user_id bigint NOT NULL
);

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE billing.invoices ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME billing.invoices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);
