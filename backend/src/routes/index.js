const express = require('express');

const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const familyRoutes = require('./family.routes');
const memberRoutes = require('./member.routes');
const relationshipRoutes = require('./relationship.routes');
const documentRoutes = require('./document.routes');
const verificationRoutes = require('./verification.routes');
const dashboardRoutes = require('./dashboard.routes');
const duplicateRoutes = require('./duplicate.routes');
const schemeRoutes = require('./scheme.routes');
const beneficiaryRoutes = require('./beneficiary.routes');
const auditRoutes = require('./audit.routes');

const router = express.Router();

router.use(healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/families', familyRoutes);
router.use('/members', memberRoutes);
router.use('/relationships', relationshipRoutes);
router.use('/documents', documentRoutes);
router.use('/verification', verificationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/duplicates', duplicateRoutes);
router.use('/schemes', schemeRoutes);
router.use('/beneficiaries', beneficiaryRoutes);
router.use('/audit', auditRoutes);

module.exports = router;
