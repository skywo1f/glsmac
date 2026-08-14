const milliseconds_since = (started_at) => {
	return (test.get_current_time_nano() - started_at) / 1000000;
};

let started_at = test.get_current_time_nano();
const generated = #include('../default/units/generated');

started_at = test.get_current_time_nano();
generated.generate_all();
#print(
	'GENERATED_UNITS_BUILD_MS=' + #to_string(milliseconds_since(started_at)) +
	' COUNT=' + #to_string(#sizeof(generated.definitions))
);

started_at = test.get_current_time_nano();
const content = #include('./_content_validation_common');
#print('GENERATED_UNITS_CONTENT_INCLUDE_MS=' + #to_string(milliseconds_since(started_at)));

started_at = test.get_current_time_nano();
const catalog = content.make_catalog();
#print('GENERATED_UNITS_CATALOG_CLONE_MS=' + #to_string(milliseconds_since(started_at)));

started_at = test.get_current_time_nano();
const validation = content.validator.validate(catalog);
#print('GENERATED_UNITS_VALIDATE_MS=' + #to_string(milliseconds_since(started_at)));

test.assert(#sizeof(generated.definitions) > 400);
test.assert(validation.errors == []);
