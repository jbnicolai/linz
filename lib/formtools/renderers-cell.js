var moment = require('moment'),
    linz = require('../../'),
    formtoolsUtils = require('./utils'),
    utils = require('../utils'),
    async = require('async');

var dateRenderer = module.exports.date = function dateRenderer (date, record, fieldName, model, callback) {
    return callback(null, moment(date).format('ddd DD/MM/YYYY'));
};

var linkRenderer = module.exports.overviewLink = function overviewLinkRenderer (val, record, fieldName, model, callback) {
	return callback(null, '<a href="' + linz.api.getAdminLink(model, 'overview', record._id) + '">' + val + '</a>');
};

var arrayRenderer = module.exports.array = function arrayRenderer (val, record, fieldName, model, callback) {
	var s = '';
	for (var i = 0; i < val.length; i++) {
		s += val[i].toString() + ((i < val.length-1) ? ', ' : '');
	}
	return callback(null, s);
};

var booleanRenderer = module.exports.boolean = function booleanRenderer (val, record, fieldName, model, callback) {
    return callback(null, (utils.asBoolean(val) ? 'Yes' : 'No'));
}

var referenceRenderer = module.exports.reference = function referenceRenderer (val, record, fieldName, model, callback) {

    if (linz.mongoose.models[model.schema.tree[fieldName].ref].findForReference) {
        return linz.mongoose.models[model.schema.tree[fieldName].ref].findForReference(val,callback);
    }

    linz.mongoose.models[model.schema.tree[fieldName].ref].findById(val, function (err, doc) {
        return callback(null, (doc) ? doc.title : ((val && val.length) ? val + ' (missing)' : ''));
    });

}

var referenceNameRenderer = module.exports.referenceName = function referenceNameRenderer (val, record, fieldName, model, callback) {

    linz.mongoose.models[model.schema.tree[fieldName].ref].findById(val, function (err, doc) {
        return callback(null, (doc) ? doc.title : ((val && val.length) ? val + ' (missing)' : ''));
    });

}

var urlRenderer = module.exports.url = function urlRenderer (val, record, fieldName, model, callback) {
    return callback(null, '<a href="' + val + '" target="_blank">' + val + '</a>');
};

var documentArrayRenderer = module.exports.documentArray = function documentArrayRenderer (val, record, fieldName, model, callback) {

    // get form configurations
    model.schema.tree[fieldName][0].statics.getForm(function (err, form) {

        var content = '',
            tableHeading = [],
            heading = '';

        async.eachSeries(record[fieldName], function (field, cb) {

            var row = '';

            if (field.__parentArray) {
                // this is a mongoose record, let's convert to object literal
                field = field.toObject({ virtuals: true});
            }

            async.eachSeries(Object.keys(field), function (key, fieldValueDone) {

                if (key === '_id' || key === 'id') {
                    return fieldValueDone(null);
                }

                // add unique table heading
                if (tableHeading.indexOf(form[key].label) < 0 ) {
                    tableHeading.push(form[key].label);
                }

                // mimic the format expected for model
                var embeddedModel = {
                    schema: model.schema.tree[fieldName][0]
                };

                // render field value
                defaultRenderer(field[key], field, key, embeddedModel, function (err, value) {

                    if (err) {
                        return fieldValueDone(err);
                    }

                    row += '<td>' + value + '</td>';

                    return fieldValueDone(null);

                });

            }, function (err) {

                if (err) {
                    return fieldValueDone(err);
                }

                // turn content to row
                row = '<tr>' + row + '</tr>';
                content += row;

                return cb(null);

            });


        }, function (err) {

            if (err) {
                return callback(err);
            }

            if (content.length) {

                tableHeading.forEach(function (title) {
                    heading += '<th>' + title + '</th>';
                });

                if (heading.length) {
                    heading = '<tr>' + heading + '</tr>';
                }

                content = '<table class="table table-bordered table-responsive">' + heading + content + '</table>';
            }

            return callback(null, content);

        });

    });

}

var defaultRenderer = module.exports.default = function defaultRenderer(val, record, fieldName, model, callback) {

    if (val === undefined) {
        return callback(null);
    }

    if (Array.isArray(val)) {

        if (!val.length) {
            return callback(null);
        }

        // check if this field is a document array
        if (Array.isArray(model.schema.tree[fieldName])) {
            return documentArrayRenderer(val, record, fieldName, model, callback);
        }

        return arrayRenderer(val, record, fieldName, model, callback);
    }

	if (val instanceof Date) {
        return dateRenderer(val, record, fieldName, model, callback);
    }

    if (val !== '' && utils.isBoolean(val)) {
        return booleanRenderer(val, record, fieldName, model, callback);
    }

    // check if val is a url
    var regex = new RegExp(/^(?:mailto:|http(?:s)?:\/\/|ftp(?:s)?:\/\/)[-a-zA-Z0-9@%_\+.~#?&=]{2,256}\.[a-z]{2,}\b(\/[-a-zA-Z0-9@:%_\+.~#?&\/=]*)?$/i);
    if ( typeof val === 'string' && val.match(regex)) {
        return urlRenderer(val, record, fieldName, model, callback);
    }

    // check if field is a reference document
    if (model.schema.tree[fieldName] && model.schema.tree[fieldName].ref) {

        return referenceRenderer(val, record, fieldName, model, callback);

    }

	return callback(null, val);

};
