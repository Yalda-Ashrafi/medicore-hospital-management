function pickFields(source, allowedFields) {
  return Object.fromEntries(
    allowedFields.filter((field) => Object.prototype.hasOwnProperty.call(source, field))
      .map((field) => [field, source[field]])
  );
}

module.exports = pickFields;
