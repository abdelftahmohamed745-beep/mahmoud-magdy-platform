'use strict';
/*
 * مسار Sanctum الذي تستدعيه الواجهة قبل تسجيل الدخول.
 * التوثيق هنا بالتوكن، لذلك نكتفي برد 204 كما يفعل Laravel.
 */
const { handle } = require('../../lib/app');

module.exports = handle;
